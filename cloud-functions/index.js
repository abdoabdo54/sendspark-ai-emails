
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure nodemailer transporter based on account type - MAXIMUM SPEED
function createTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    console.log(`🔧 Creating SMTP transporter for ${account.name}:`, {
      host: config.host,
      port: config.port,
      user: config.username || config.user,
      hasPassword: !!(config.password || config.pass)
    });

    return nodemailer.createTransporter({
      host: config.host,
      port: config.port || 587,
      secure: config.secure || config.encryption === 'ssl' || false,
      auth: {
        user: config.username || config.user,
        pass: config.password || config.pass
      },
      pool: true,
      maxConnections: 100,
      maxMessages: 1000,
      rateLimit: false
    });
  }
  
  return null;
}

// Send email via Apps Script
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    const scriptUrl = config.script_url;
    
    if (!scriptUrl) {
      return { success: false, error: 'Apps Script URL not configured' };
    }

    console.log(`📧 Sending via Apps Script: ${scriptUrl}`);

    const response = await fetch(scriptUrl, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Apps Script HTTP error:`, response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log(`📧 Apps Script response:`, result);
    
    if (result.status === 'success' || result.success) {
      return { success: true, messageId: result.messageId || 'apps-script-sent' };
    } else {
      return { success: false, error: result.message || result.error || 'Apps Script error' };
    }
  } catch (error) {
    console.error(`❌ Apps Script error:`, error);
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
    console.error(`❌ SMTP error:`, error);
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

    console.log(`📧 Processing email ${globalIndex + 1}: ${recipient} via ${account.name} (${account.type})`);

    let result;

    // Send based on account type
    if (account.type === 'smtp') {
      const transporter = createTransporter(account);
      if (transporter) {
        result = await sendViaSMTP(transporter, emailData);
        transporter.close();
      } else {
        result = { success: false, error: 'Failed to create SMTP transporter' };
      }
    } else if (account.type === 'apps-script') {
      result = await sendViaAppsScript(account, emailData);
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

// Batch database update function
async function updateCampaignProgress(campaignId, sentCount, isComplete = false) {
  try {
    const updateData = {
      sent_count: sentCount
    };

    if (isComplete) {
      updateData.status = 'sent';
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', campaignId);

    if (error) {
      console.error(`❌ Database update failed:`, error);
    } else {
      console.log(`📝 Campaign progress updated: ${sentCount} emails sent`);
    }
  } catch (dbError) {
    console.error(`❌ Database update error:`, dbError);
  }
}

// Main function handler - MAXIMUM SPEED
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
      globalStartIndex = 0
    } = req.body;

    console.log(`🚀 [${campaignId}] Received request:`, {
      campaignId,
      recipients: slice?.recipients?.length || 0,
      accounts: accounts?.length || 0,
      globalStartIndex
    });

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    // Validate input
    if (!slice?.recipients || !Array.isArray(slice.recipients) || slice.recipients.length === 0) {
      console.error(`❌ No recipients provided`);
      return res.status(400).json({
        success: false,
        error: 'No recipients provided',
        received: { slice, accounts: accounts?.length || 0 }
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      console.error(`❌ No accounts provided`);
      return res.status(400).json({
        success: false,
        error: 'No accounts provided',
        received: { recipients: slice.recipients.length, accounts: accounts?.length || 0 }
      });
    }

    console.log(`🚀 [${campaignId}] MAXIMUM SPEED PROCESSING: ${slice.recipients.length} emails starting from global index ${globalStartIndex}`);
    console.log(`📊 [${campaignId}] Using ${accounts.length} accounts with perfect rotation`);
    
    // Log account details for debugging
    accounts.forEach((account, index) => {
      console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      if (account.type === 'apps-script') {
        console.log(`     Script URL: ${account.config?.script_url || 'NOT SET'}`);
      }
    });

    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const batchSize = 20; // Reduced for better error handling

    console.log(`⚡ [${campaignId}] Processing in MAXIMUM SPEED batches of ${batchSize}`);

    // Prepare all email tasks with GLOBAL INDEXING
    const emailTasks = slice.recipients.map((recipient, localIndex) => {
      const globalIndex = globalStartIndex + localIndex;
      const accountIndex = globalIndex % accounts.length;
      const account = accounts[accountIndex];
      
      console.log(`📧 [${campaignId}] Email ${globalIndex + 1}: ${recipient} → Account ${accountIndex + 1}/${accounts.length} (${account.name})`);
      
      return () => processEmail(recipient, account, campaignData, globalIndex, accounts.length);
    });

    // MAXIMUM SPEED: Process emails in batches
    const results = [];
    let totalSentInThisFunction = 0;
    
    for (let i = 0; i < emailTasks.length; i += batchSize) {
      const batch = emailTasks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(emailTasks.length / batchSize);
      
      console.log(`🚀 [${campaignId}] Processing batch ${batchNumber}/${totalBatches}: ${batch.length} emails - MAXIMUM SPEED`);
      
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
      
      // Count successful sends in this batch
      const batchSentCount = batchResults.filter(r => r.status === 'sent').length;
      totalSentInThisFunction += batchSentCount;
      
      console.log(`✅ Batch ${batchNumber} completed: ${batchSentCount}/${batch.length} emails sent`);
      
      // Update database progress every batch
      if (batchSentCount > 0) {
        try {
          const { data: currentCampaign } = await supabase
            .from('email_campaigns')
            .select('sent_count')
            .eq('id', campaignId)
            .single();

          const newSentCount = (currentCampaign?.sent_count || 0) + batchSentCount;
          await updateCampaignProgress(campaignId, newSentCount);
        } catch (error) {
          console.error(`❌ Progress update failed for batch ${batchNumber}:`, error);
        }
      }
    }

    // Calculate final results
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((sentCount / slice.recipients.length) * 100);

    // Account distribution verification
    console.log(`📊 [${campaignId}] FINAL ACCOUNT DISTRIBUTION:`);
    const accountDistribution = accounts.map((account, index) => {
      const accountResults = results.filter(r => r.accountIndex === index + 1);
      const accountSent = accountResults.filter(r => r.status === 'sent').length;
      const accountFailed = accountResults.filter(r => r.status === 'failed').length;
      console.log(`   Account ${index + 1} (${account.name}): ${accountSent} sent, ${accountFailed} failed`);
      return {
        accountName: account.name,
        accountId: account.id,
        accountIndex: index + 1,
        emailsSent: accountSent,
        emailsFailed: accountFailed
      };
    });

    console.log(`✅ [${campaignId}] MAXIMUM SPEED completed: ${sentCount} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);
    console.log(`⚡ [${campaignId}] Processing rate: ${Math.round(slice.recipients.length / (processingTime / 1000))} emails/second`);

    // Log failed emails for debugging
    const failedEmails = results.filter(r => r.status === 'failed');
    if (failedEmails.length > 0) {
      console.log(`❌ Failed emails:`, failedEmails.map(f => `${f.recipient}: ${f.error}`));
    }

    res.status(200).json({
      success: true,
      campaignId,
      processed: slice.recipients.length,
      sent: sentCount,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      emailsPerSecond: Math.round(slice.recipients.length / (processingTime / 1000)),
      sendingMode: 'maximum-speed',
      batchesProcessed: Math.ceil(slice.recipients.length / batchSize),
      batchSize,
      maximumSpeed: true,
      globalStartIndex,
      accountDistribution,
      failedEmails: failedEmails.slice(0, 5), // First 5 failed for debugging
      results: results.slice(-5) // Last 5 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Function error:', error);
    
    // Update campaign status to failed
    if (req.body.campaignId) {
      try {
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', req.body.campaignId);
      } catch (dbError) {
        console.error('❌ Failed to update campaign status:', dbError);
      }
    }
    
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
