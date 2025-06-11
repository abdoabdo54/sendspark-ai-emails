
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

// Add tracking pixels and links
function addTracking(htmlContent, campaignId, recipient, trackingConfig) {
  let trackedContent = htmlContent;
  
  if (trackingConfig?.trackOpens) {
    const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-open?campaign=${campaignId}&email=${encodeURIComponent(recipient)}" width="1" height="1" style="display:none;" />`;
    trackedContent += trackingPixel;
  }
  
  if (trackingConfig?.trackClicks) {
    // Replace links with tracking URLs
    trackedContent = trackedContent.replace(
      /href="([^"]+)"/g,
      `href="${supabaseUrl}/functions/v1/track-click?campaign=${campaignId}&email=${encodeURIComponent(recipient)}&url=$1"`
    );
  }
  
  return trackedContent;
}

// Enhanced rotation helpers
function rotateFromName(config, index) {
  if (!config.rotation?.fromName || !config.rotation?.fromNameVariations?.length) {
    return config.baseName || 'Default Sender';
  }
  
  const variations = config.rotation.fromNameVariations;
  return variations[index % variations.length];
}

function rotateSubject(config, index) {
  if (!config.rotation?.subject || !config.rotation?.subjectVariations?.length) {
    return config.baseSubject || 'Default Subject';
  }
  
  const variations = config.rotation.subjectVariations;
  return variations[index % variations.length];
}

// Apply sending mode delays
async function applySendingDelay(sendingMode) {
  switch (sendingMode) {
    case 'controlled':
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
      break;
    case 'fast':
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 seconds
      break;
    case 'zero-delay':
    default:
      // No delay
      break;
  }
}

// Main function - Enhanced for Gen2 with advanced features
functions.http('sendBatch', async (req, res) => {
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

    console.log(`🚀 [${campaignId}] Processing slice: ${slice.recipients.length} emails`);

    const results = [];
    let accountIndex = 0;

    // Get enhanced configuration
    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'controlled';
    const dispatchMethod = config.dispatchMethod || 'parallel';
    const rotationConfig = config.rotation || {};
    const trackingConfig = config.tracking || {};
    const testAfterConfig = config.testAfter || {};

    console.log(`📊 [${campaignId}] Mode: ${sendingMode}, Dispatch: ${dispatchMethod}, Rotation: ${rotationConfig.fromName || rotationConfig.subject ? 'enabled' : 'disabled'}`);

    // Account selection strategy based on dispatch method
    const getAccount = (index) => {
      switch (dispatchMethod) {
        case 'round-robin':
          return accounts[index % accounts.length];
        case 'sequential':
          return accounts[Math.floor(index / Math.ceil(slice.recipients.length / accounts.length))];
        case 'parallel':
        default:
          return accounts[index % accounts.length];
      }
    };

    // Process each recipient in the slice
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i];
      const account = getAccount(i);
      accountIndex++;

      try {
        // Apply enhanced rotation
        const fromName = rotateFromName({
          baseName: campaignData.from_name,
          rotation: rotationConfig
        }, i);
        
        const subject = rotateSubject({
          baseSubject: campaignData.subject,
          rotation: rotationConfig
        }, i);

        // Prepare email content
        let htmlContent = campaignData.html_content;
        let textContent = campaignData.text_content;

        // Add tracking if enabled
        if (trackingConfig.enabled) {
          htmlContent = addTracking(htmlContent, campaignId, recipient, trackingConfig);
        }

        const emailData = {
          to: recipient,
          subject: subject,
          html: htmlContent,
          text: textContent,
          fromName: fromName,
          fromEmail: account.email
        };

        let result;

        // Send based on account type with enhanced error handling
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
            fromName: fromName,
            subject: subject,
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

        // Enhanced Test-After functionality
        if (testAfterConfig.enabled && testAfterConfig.email) {
          const testAfterCount = testAfterConfig.count || 500;
          
          if ((i + 1) % testAfterCount === 0) {
            console.log(`📧 [${campaignId}] Sending test-after email for batch ${Math.floor((i + 1) / testAfterCount)}`);
            
            const testEmailData = {
              to: testAfterConfig.email,
              subject: `Test-After: ${subject} - Batch ${Math.floor((i + 1) / testAfterCount)}`,
              html: `
                <h3>Test-After Report - ${campaignId}</h3>
                <p><strong>Campaign:</strong> ${campaignData.subject}</p>
                <p><strong>Emails Sent:</strong> ${i + 1}</p>
                <p><strong>Last Account Used:</strong> ${account.name} (${account.email})</p>
                <p><strong>Sending Mode:</strong> ${sendingMode}</p>
                <p><strong>Dispatch Method:</strong> ${dispatchMethod}</p>
                <p><strong>Current From Name:</strong> ${fromName}</p>
                <p><strong>Current Subject:</strong> ${subject}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <hr>
                <p><strong>Success Rate:</strong> ${results.filter(r => r.status === 'sent').length}/${results.length}</p>
              `,
              text: `Test-After Report: Successfully sent ${i + 1} emails. Campaign: ${campaignData.subject}. Mode: ${sendingMode} (${dispatchMethod})`,
              fromName: fromName,
              fromEmail: account.email
            };

            try {
              if (account.type === 'smtp') {
                const transporter = createTransporter(account.config);
                if (transporter) {
                  await sendViaSMTP(transporter, testEmailData);
                  transporter.close();
                }
              } else if (account.type === 'apps-script') {
                await sendViaAppsScript(account.config, testEmailData);
              }
              console.log(`📧 [${campaignId}] Test-after email sent successfully`);
            } catch (testError) {
              console.log(`⚠️ [${campaignId}] Test-after email failed: ${testError.message}`);
            }
          }
        }

        // Apply sending mode delays
        await applySendingDelay(sendingMode);

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
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          sent_count: supabase.rpc('increment_sent_count', { 
            campaign_id: campaignId, 
            increment_by: sentCount 
          })
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
      rotationEnabled: rotationConfig.fromName || rotationConfig.subject,
      trackingEnabled: trackingConfig.enabled,
      testAfterEnabled: testAfterConfig.enabled,
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
});
