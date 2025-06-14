
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
      organizationId 
    } = req.body;

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🚀 [${campaignId}] Processing slice with EQUAL DISTRIBUTION: ${slice.recipients.length} emails across ${accounts.length} accounts`);

    const results = [];

    // Get configuration
    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const equalAccountRotation = config.equalAccountRotation || true;

    console.log(`📊 [${campaignId}] Mode: ${sendingMode}, Equal Rotation: ${equalAccountRotation}`);

    // PERFECT EQUAL DISTRIBUTION: Process each recipient with proper account rotation
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i];
      // EQUAL ROTATION: Use modulo to ensure perfect distribution across accounts
      const accountIndex = i % accounts.length;
      const account = accounts[accountIndex];

      console.log(`📧 [${campaignId}] Email ${i + 1}/${slice.recipients.length}: ${recipient} → Account ${accountIndex + 1}/${accounts.length} (${account.name})`);

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

        // Send based on account type with proper error handling
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

        if (result.success) {
          console.log(`✅ [${campaignId}] ${i+1}/${slice.recipients.length} → ${recipient} via ${account.name} SUCCESS`);
          results.push({
            recipient,
            status: 'sent',
            accountType: account.type,
            accountName: account.name,
            accountIndex: accountIndex + 1,
            messageId: result.messageId,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`❌ [${campaignId}] ${i+1}/${slice.recipients.length} → ${recipient} via ${account.name} FAILED: ${result.error}`);
          results.push({
            recipient,
            status: 'failed',
            error: result.error,
            accountType: account.type,
            accountName: account.name,
            accountIndex: accountIndex + 1,
            timestamp: new Date().toISOString()
          });
        }

        // Apply delay based on sending mode (zero-delay = no delay)
        if (sendingMode === 'controlled') {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (sendingMode === 'fast') {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // zero-delay mode: no delay

      } catch (error) {
        console.error(`❌ [${campaignId}] Error processing ${recipient}:`, error);
        results.push({
          recipient,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate results
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((sentCount / slice.recipients.length) * 100);

    // Log account distribution summary
    console.log(`📊 [${campaignId}] ACCOUNT DISTRIBUTION SUMMARY:`);
    accounts.forEach((account, index) => {
      const accountResults = results.filter(r => r.accountIndex === index + 1);
      const accountSent = accountResults.filter(r => r.status === 'sent').length;
      console.log(`   Account ${index + 1} (${account.name}): ${accountSent} emails sent`);
    });

    console.log(`✅ [${campaignId}] Slice completed: ${sentCount} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: slice.recipients.length,
      sent: sentCount,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      sendingMode,
      equalDistribution: true,
      accountDistribution: accounts.map((account, index) => ({
        accountName: account.name,
        accountIndex: index + 1,
        emailsSent: results.filter(r => r.accountIndex === index + 1 && r.status === 'sent').length
      })),
      results: results.slice(-5) // Return last 5 results for debugging
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
