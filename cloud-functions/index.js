
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
      maxConnections: 10,
      maxMessages: 100
    });
  }
  
  // For other types, we'll handle them differently
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

// Add tracking pixels and links
function addTracking(htmlContent, campaignId, recipient, trackingConfig) {
  let trackedContent = htmlContent;
  
  if (trackingConfig.trackOpens) {
    const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-open?campaign=${campaignId}&email=${encodeURIComponent(recipient)}" width="1" height="1" style="display:none;" />`;
    trackedContent += trackingPixel;
  }
  
  if (trackingConfig.trackClicks) {
    // Replace links with tracking URLs
    trackedContent = trackedContent.replace(
      /href="([^"]+)"/g,
      `href="${supabaseUrl}/functions/v1/track-click?campaign=${campaignId}&email=${encodeURIComponent(recipient)}&url=$1"`
    );
  }
  
  return trackedContent;
}

// Main function
functions.http('sendBatch', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { 
      campaignId, 
      slice, 
      campaignData, 
      accounts, 
      organizationId 
    } = req.body;

    console.log(`🚀 Processing slice: ${slice.recipients.length} emails for campaign ${campaignId}`);

    const results = [];
    let accountIndex = 0;

    // Process each recipient in the slice
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i];
      
      // Rotate through available accounts
      const account = accounts[accountIndex % accounts.length];
      accountIndex++;

      try {
        // Prepare email content
        let htmlContent = campaignData.html_content;
        let textContent = campaignData.text_content;

        // Add tracking if enabled
        if (campaignData.config?.tracking?.enabled) {
          htmlContent = addTracking(htmlContent, campaignId, recipient, campaignData.config.tracking);
        }

        const emailData = {
          to: recipient,
          subject: campaignData.subject,
          html: htmlContent,
          text: textContent,
          fromName: campaignData.from_name,
          fromEmail: account.email
        };

        let result;

        // Send based on account type
        if (account.type === 'smtp') {
          const transporter = createTransporter(account.config);
          if (transporter) {
            result = await sendViaSMTP(transporter, emailData);
          } else {
            result = { success: false, error: 'Failed to create SMTP transporter' };
          }
        } else if (account.type === 'apps-script') {
          result = await sendViaAppsScript(account.config, emailData);
        } else {
          result = { success: false, error: `Unsupported account type: ${account.type}` };
        }

        if (result.success) {
          console.log(`✅ Sent to ${recipient} via ${account.type}`);
          results.push({
            recipient,
            status: 'sent',
            accountType: account.type,
            accountName: account.name,
            messageId: result.messageId
          });
        } else {
          console.log(`❌ Failed to ${recipient}: ${result.error}`);
          results.push({
            recipient,
            status: 'failed',
            error: result.error,
            accountType: account.type,
            accountName: account.name
          });
        }

        // Test-After functionality
        if (campaignData.config?.testAfter?.enabled) {
          const testAfterCount = campaignData.config.testAfter.count;
          const testAfterEmail = campaignData.config.testAfter.email;
          
          if ((i + 1) % testAfterCount === 0) {
            console.log(`📧 Sending test-after email for batch ${Math.floor((i + 1) / testAfterCount)}`);
            
            const testEmailData = {
              to: testAfterEmail,
              subject: `Test-After: ${campaignData.subject} - Batch ${Math.floor((i + 1) / testAfterCount)}`,
              html: `<h3>Test-After Report</h3><p>Successfully sent ${i + 1} emails.</p><p>Campaign: ${campaignData.subject}</p>`,
              text: `Test-After Report: Successfully sent ${i + 1} emails. Campaign: ${campaignData.subject}`,
              fromName: campaignData.from_name,
              fromEmail: account.email
            };

            if (account.type === 'smtp') {
              const transporter = createTransporter(account.config);
              if (transporter) {
                await sendViaSMTP(transporter, testEmailData);
              }
            } else if (account.type === 'apps-script') {
              await sendViaAppsScript(account.config, testEmailData);
            }
          }
        }

        // Apply sending mode delays
        if (campaignData.config?.sendingMode === 'controlled') {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        } else if (campaignData.config?.sendingMode === 'fast') {
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
        }
        // zero-delay mode: no delay

      } catch (error) {
        console.error(`❌ Error processing ${recipient}:`, error);
        results.push({
          recipient,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update campaign statistics in Supabase
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    try {
      await supabase
        .from('email_campaigns')
        .update({
          sent_count: supabase.rpc('increment_sent_count', { campaign_id: campaignId, increment_by: sentCount })
        })
        .eq('id', campaignId);
    } catch (dbError) {
      console.error('Failed to update campaign stats:', dbError);
    }

    console.log(`✅ Slice completed: ${sentCount} sent, ${failedCount} failed`);

    res.status(200).json({
      success: true,
      processed: slice.recipients.length,
      sent: sentCount,
      failed: failedCount,
      results: results
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
