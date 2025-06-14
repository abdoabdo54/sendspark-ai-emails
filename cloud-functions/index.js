
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure nodemailer transporter based on account type
function createTransporter(accountConfig) {
  if (accountConfig.type === 'smtp') {
    return nodemailer.createTransporter({
      host: accountConfig.host,
      port: accountConfig.port,
      secure: accountConfig.secure || false,
      auth: {
        user: accountConfig.user,
        pass: accountConfig.pass
      },
      pool: true,
      maxConnections: 20,
      maxMessages: 200,
      rateLimit: 10
    });
  }
  
  return null;
}

// Send email via Apps Script
async function sendViaAppsScript(accountConfig, emailData) {
  try {
    const response = await fetch(accountConfig.script_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: emailData.to,
        subject: emailData.subject,
        htmlBody: emailData.html,
        plainBody: emailData.text || '',
        fromName: emailData.fromName,
        fromAlias: emailData.fromEmail
      })
    });

    const result = await response.json();
    
    if (response.ok && result.status === 'success') {
      return { success: true, messageId: result.messageId };
    } else {
      return { success: false, error: result.message || 'Apps Script error' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Send email via SMTP
async function sendViaSMTP(transporter, emailData) {
  try {
    const info = await transporter.sendMail({
      from: `"${emailData.fromName}" <${emailData.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process single email
async function processEmail(recipient, account, campaignData, globalIndex, totalAccounts) {
  try {
    const emailData = {
      to: recipient,
      subject: campaignData.subject,
      html: campaignData.html_content,
      text: campaignData.text_content,
      fromName: campaignData.from_name,
      fromEmail: account.email
    };

    let result;

    // Send based on account type
    if (account.type === 'smtp') {
      const transporter = createTransporter(account.config);
      if (transporter) {
        result = await sendViaSMTP(transporter, emailData);
        transporter.close();
      } else {
        result = { success: false, error: 'Failed to create SMTP transporter' };
      }
    } else if (account.type === 'apps-script') {
      result = await sendViaAppsScript(account.config, emailData);
    } else {
      result = { success: false, error: `Unsupported account type: ${account.type}` };
    }

    const accountIndex = globalIndex % totalAccounts;
    
    if (result.success) {
      console.log(`✅ Email ${globalIndex + 1} → ${recipient} via Account ${accountIndex + 1} (${account.name}) SUCCESS`);
      return {
        recipient,
        status: 'sent',
        accountType: account.type,
        accountName: account.name,
        accountIndex: accountIndex + 1,
        accountId: account.id,
        globalIndex: globalIndex + 1,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`❌ Email ${globalIndex + 1} → ${recipient} via Account ${accountIndex + 1} (${account.name}) FAILED: ${result.error}`);
      return {
        recipient,
        status: 'failed',
        error: result.error,
        accountType: account.type,
        accountName: account.name,
        accountIndex: accountIndex + 1,
        accountId: account.id,
        globalIndex: globalIndex + 1,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`❌ Error processing ${recipient}:`, error);
    return {
      recipient,
      status: 'failed',
      error: error.message,
      globalIndex: globalIndex + 1,
      timestamp: new Date().toISOString()
    };
  }
}

// Main function handler
const sendEmailCampaignZeroDelay = async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const startTime = Date.now();

  try {
    const { 
      campaignId, 
      slice, 
      campaignData, 
      accounts, 
      organizationId,
      globalStartIndex = 0 // NEW: Starting index for global rotation
    } = req.body;

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🚀 [${campaignId}] PERFECT GLOBAL ROTATION: Processing ${slice.recipients.length} emails starting from global index ${globalStartIndex}`);
    console.log(`📊 [${campaignId}] Using ${accounts.length} accounts with perfect rotation`);

    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const batchSize = sendingMode === 'zero-delay' ? 50 : 10; // Parallel batch size

    console.log(`⚡ [${campaignId}] Parallel processing in batches of ${batchSize}`);

    // Prepare all email tasks with GLOBAL INDEXING
    const emailTasks = slice.recipients.map((recipient, localIndex) => {
      const globalIndex = globalStartIndex + localIndex; // CRITICAL: Global index calculation
      const accountIndex = globalIndex % accounts.length; // PERFECT: Global rotation
      const account = accounts[accountIndex];
      
      console.log(`📧 [${campaignId}] Email ${globalIndex + 1}: ${recipient} → Account ${accountIndex + 1}/${accounts.length} (${account.name})`);
      
      return () => processEmail(recipient, account, campaignData, globalIndex, accounts.length);
    });

    // Process emails in parallel batches for maximum speed
    const results = [];
    
    for (let i = 0; i < emailTasks.length; i += batchSize) {
      const batch = emailTasks.slice(i, i + batchSize);
      console.log(`🚀 [${campaignId}] Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.length} emails in parallel`);
      
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
      
      // Small delay between batches if not zero-delay mode
      if (sendingMode !== 'zero-delay' && i + batchSize < emailTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate results
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((sentCount / slice.recipients.length) * 100);

    // PERFECT ACCOUNT DISTRIBUTION VERIFICATION
    console.log(`📊 [${campaignId}] PERFECT GLOBAL ACCOUNT DISTRIBUTION:`);
    accounts.forEach((account, index) => {
      const accountResults = results.filter(r => r.accountIndex === index + 1);
      const accountSent = accountResults.filter(r => r.status === 'sent').length;
      console.log(`   Account ${index + 1} (${account.name}): ${accountSent} emails sent`);
    });

    // Update campaign statistics
    try {
      const { data: currentCampaign } = await supabase
        .from('email_campaigns')
        .select('sent_count')
        .eq('id', campaignId)
        .single();

      const newSentCount = (currentCampaign?.sent_count || 0) + sentCount;

      await supabase
        .from('email_campaigns')
        .update({
          sent_count: newSentCount
        })
        .eq('id', campaignId);

      console.log(`📝 [${campaignId}] Updated campaign sent_count to ${newSentCount}`);
    } catch (dbError) {
      console.error(`❌ [${campaignId}] Database update failed:`, dbError);
    }

    console.log(`✅ [${campaignId}] Slice completed: ${sentCount} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);
    console.log(`⚡ [${campaignId}] Parallel processing: ${Math.round(slice.recipients.length / (processingTime / 1000))} emails/second`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: slice.recipients.length,
      sent: sentCount,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      emailsPerSecond: Math.round(slice.recipients.length / (processingTime / 1000)),
      sendingMode,
      parallelBatches: Math.ceil(slice.recipients.length / batchSize),
      batchSize,
      perfectGlobalRotation: true,
      globalStartIndex,
      accountDistribution: accounts.map((account, index) => ({
        accountName: account.name,
        accountId: account.id,
        accountIndex: index + 1,
        emailsSent: results.filter(r => r.accountIndex === index + 1 && r.status === 'sent').length
      })),
      results: results.slice(-10) // Last 10 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Register the function with Functions Framework
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
