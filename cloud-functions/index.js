
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
      rateLimit: 10 // emails per second
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

// Main function handler for Gen2
async function sendBatch(req, res) {
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

    console.log(`🚀 [${campaignId}] Processing slice: ${slice.recipients.length} emails`);

    const results = [];

    // Get configuration
    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const dispatchMethod = config.dispatchMethod || 'parallel';

    console.log(`📊 [${campaignId}] Mode: ${sendingMode}, Dispatch: ${dispatchMethod}`);

    // Process each recipient in the slice
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i];
      const account = accounts[i % accounts.length];

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

        if (result.success) {
          console.log(`✅ [${campaignId}] ${i+1}/${slice.recipients.length} → ${recipient} via ${account.name}`);
          results.push({
            recipient,
            status: 'sent',
            accountType: account.type,
            accountName: account.name,
            messageId: result.messageId,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`❌ [${campaignId}] ${i+1}/${slice.recipients.length} → ${recipient}: ${result.error}`);
          results.push({
            recipient,
            status: 'failed',
            error: result.error,
            accountType: account.type,
            accountName: account.name,
            timestamp: new Date().toISOString()
          });
        }

        // Apply delay based on sending mode
        if (sendingMode === 'controlled') {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
        } else if (sendingMode === 'fast') {
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 seconds
        }
        // zero-delay mode has no delay

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

    // Update campaign statistics in Supabase
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;

    try {
      // Get current campaign data to increment sent count
      const { data: currentCampaign } = await supabase
        .from('email_campaigns')
        .select('sent_count')
        .eq('id', campaignId)
        .single();

      const newSentCount = (currentCampaign?.sent_count || 0) + sentCount;

      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          sent_count: newSentCount
        })
        .eq('id', campaignId);

      if (updateError) {
        console.error(`❌ [${campaignId}] Failed to update campaign stats:`, updateError);
      }
    } catch (dbError) {
      console.error(`❌ [${campaignId}] Database update failed:`, dbError);
    }

    const successRate = Math.round((sentCount / slice.recipients.length) * 100);
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
      dispatchMethod,
      results: results.slice(-5) // Only return last 5 results to keep response size manageable
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
}

// Register the main function
functions.http('sendBatch', sendBatch);
