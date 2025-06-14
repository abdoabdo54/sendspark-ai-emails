
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
      maxConnections: 10, // Reduced for stability
      maxMessages: 100,   // Reduced for stability
      rateLimit: 5        // Reduced for stability
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

// OPTIMIZED: Batch database update function
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
      globalStartIndex = 0
    } = req.body;

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🚀 [${campaignId}] OPTIMIZED PROCESSING: ${slice.recipients.length} emails starting from global index ${globalStartIndex}`);
    console.log(`📊 [${campaignId}] Using ${accounts.length} accounts with perfect rotation`);

    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const batchSize = sendingMode === 'zero-delay' ? 25 : 10; // REDUCED for stability

    console.log(`⚡ [${campaignId}] Processing in optimized batches of ${batchSize}`);

    // Prepare all email tasks with GLOBAL INDEXING
    const emailTasks = slice.recipients.map((recipient, localIndex) => {
      const globalIndex = globalStartIndex + localIndex;
      const accountIndex = globalIndex % accounts.length;
      const account = accounts[accountIndex];
      
      console.log(`📧 [${campaignId}] Email ${globalIndex + 1}: ${recipient} → Account ${accountIndex + 1}/${accounts.length} (${account.name})`);
      
      return () => processEmail(recipient, account, campaignData, globalIndex, accounts.length);
    });

    // OPTIMIZED: Process emails in smaller batches with progress updates
    const results = [];
    let totalSentInThisFunction = 0;
    
    for (let i = 0; i < emailTasks.length; i += batchSize) {
      const batch = emailTasks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(emailTasks.length / batchSize);
      
      console.log(`🚀 [${campaignId}] Processing batch ${batchNumber}/${totalBatches}: ${batch.length} emails`);
      
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
      
      // Count successful sends in this batch
      const batchSentCount = batchResults.filter(r => r.status === 'sent').length;
      totalSentInThisFunction += batchSentCount;
      
      // OPTIMIZED: Update database progress every batch (not every email)
      if (batchSentCount > 0) {
        // Get current campaign sent count and add this batch
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
      
      // Small delay between batches for system stability
      if (i + batchSize < emailTasks.length) {
        const delay = sendingMode === 'zero-delay' ? 200 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Calculate final results
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((sentCount / slice.recipients.length) * 100);

    // OPTIMIZED: Account distribution verification
    console.log(`📊 [${campaignId}] FINAL ACCOUNT DISTRIBUTION:`);
    accounts.forEach((account, index) => {
      const accountResults = results.filter(r => r.accountIndex === index + 1);
      const accountSent = accountResults.filter(r => r.status === 'sent').length;
      console.log(`   Account ${index + 1} (${account.name}): ${accountSent} emails sent`);
    });

    console.log(`✅ [${campaignId}] Function completed: ${sentCount} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);
    console.log(`⚡ [${campaignId}] Processing rate: ${Math.round(slice.recipients.length / (processingTime / 1000))} emails/second`);

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
      batchesProcessed: Math.ceil(slice.recipients.length / batchSize),
      batchSize,
      optimizedForStability: true,
      globalStartIndex,
      accountDistribution: accounts.map((account, index) => ({
        accountName: account.name,
        accountId: account.id,
        accountIndex: index + 1,
        emailsSent: results.filter(r => r.accountIndex === index + 1 && r.status === 'sent').length
      })),
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
