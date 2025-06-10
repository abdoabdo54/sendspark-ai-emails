
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rotation helpers
function getRotatedFromName(rotation, emailIndex) {
  if (!rotation.useFromNameRotation || !rotation.fromNames || rotation.fromNames.length === 0) {
    return null;
  }
  return rotation.fromNames[emailIndex % rotation.fromNames.length];
}

function getRotatedSubject(rotation, emailIndex) {
  if (!rotation.useSubjectRotation || !rotation.subjects || rotation.subjects.length === 0) {
    return null;
  }
  return rotation.subjects[emailIndex % rotation.subjects.length];
}

// Test after email helper
function shouldSendTestEmail(globalEmailIndex, testAfterConfig) {
  if (!testAfterConfig.useTestAfter || !testAfterConfig.testAfterEmail || !testAfterConfig.testAfterCount) {
    return false;
  }
  
  const emailNumber = globalEmailIndex + 1;
  return emailNumber > 0 && (emailNumber % testAfterConfig.testAfterCount === 0);
}

// Delay calculation
function calculateDelayMs(config) {
  const sendingMode = config.sendingMode || 'controlled';
  
  switch (sendingMode) {
    case 'maximum':
      return 0;
    case 'fast':
      return 100;
    case 'controlled':
      if (config.useCustomDelay) {
        return Math.max(0, config.customDelayMs || 1000);
      }
      const emailsPerSecond = config.emailsPerSecond || 1;
      return Math.max(0, (1000 / emailsPerSecond));
    default:
      return 1000;
  }
}

functions.http('sendEmailCampaign', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    console.log('🚀 Google Cloud Function started');
    
    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {},
      rotation = {},
      testAfterConfig = {}
    } = req.body || {};
    
    if (!campaignId || !emailsByAccount || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required parameters');
    }

    console.log(`Processing campaign ${campaignId} with ${Object.keys(emailsByAccount).length} accounts`);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const delayMs = calculateDelayMs(config);
    const sendingMode = config.sendingMode || 'controlled';
    
    console.log(`Sending mode: ${sendingMode}, Delay: ${delayMs}ms`);

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', campaignId);

    let totalSent = 0;
    let totalFailed = 0;
    let testEmailsSent = 0;
    let globalEmailIndex = 0;

    // Process all accounts
    for (const [accountId, accountData] of Object.entries(emailsByAccount)) {
      const { type, config: accountConfig, emails, accountInfo } = accountData;
      
      console.log(`Processing ${type} account: ${accountInfo.email} (${emails.length} emails)`);
      
      try {
        if (type === 'smtp') {
          const { host, port, user, pass, secure } = accountConfig;
          
          if (!host || !port || !user || !pass) {
            throw new Error(`SMTP configuration incomplete for ${accountInfo.email}`);
          }

          const transporterConfig = {
            host,
            port: parseInt(port),
            secure: parseInt(port) === 465,
            auth: { user, pass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 60000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
            pool: true,
            maxConnections: sendingMode === 'maximum' ? 5 : 1,
            maxMessages: sendingMode === 'maximum' ? 1000 : 100
          };

          if (parseInt(port) !== 465) {
            transporterConfig.requireTLS = true;
          }

          const transporter = nodemailer.createTransporter(transporterConfig);

          // Verify connection
          await transporter.verify();
          console.log(`SMTP connection verified for ${accountInfo.email}`);

          // Determine batch size
          let batchSize = 1;
          switch (sendingMode) {
            case 'maximum':
              batchSize = Math.min(emails.length, 10);
              break;
            case 'fast':
              batchSize = Math.min(emails.length, 5);
              break;
            case 'controlled':
              batchSize = Math.min(emails.length, config.burstSize || 1);
              break;
          }

          // Process emails in batches
          for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (emailData, localIndex) => {
              try {
                const currentGlobalIndex = globalEmailIndex + i + localIndex;
                
                // Apply rotation
                const fromName = getRotatedFromName(rotation, currentGlobalIndex) || emailData.fromName || accountInfo.name;
                const subject = getRotatedSubject(rotation, currentGlobalIndex) || emailData.subject;

                const mailOptions = {
                  from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                  to: emailData.recipient,
                  subject: subject,
                  html: emailData.htmlContent || '',
                  text: emailData.textContent || ''
                };

                console.log(`Sending email ${currentGlobalIndex + 1} to ${emailData.recipient}`);
                
                const info = await transporter.sendMail(mailOptions);
                totalSent++;
                
                // Send test email if needed
                if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                  try {
                    const testNumber = Math.floor((currentGlobalIndex + 1) / testAfterConfig.testAfterCount);
                    const testSubject = `${testAfterConfig.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'} #${testNumber}`;
                    
                    const testMailOptions = {
                      from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                      to: testAfterConfig.testAfterEmail,
                      subject: testSubject,
                      html: `
                        <h2>📊 Test Email Delivery Report #${testNumber}</h2>
                        <p><strong>Campaign:</strong> ${campaignId}</p>
                        <p><strong>Emails Delivered:</strong> ${currentGlobalIndex + 1}</p>
                        <p><strong>Test Frequency:</strong> Every ${testAfterConfig.testAfterCount} emails</p>
                        <p><strong>Account:</strong> ${accountInfo.email}</p>
                        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                        <hr/>
                        <h3>Original Email Sample:</h3>
                        <p><strong>From:</strong> ${fromName}</p>
                        <p><strong>Subject:</strong> ${subject}</p>
                        <p><strong>To:</strong> ${emailData.recipient}</p>
                        <div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
                          ${emailData.htmlContent || ''}
                        </div>
                      `,
                      text: `TEST DELIVERY REPORT #${testNumber}\n\nCampaign: ${campaignId}\nEmails Delivered: ${currentGlobalIndex + 1}\nTest Frequency: Every ${testAfterConfig.testAfterCount} emails\n\n${emailData.textContent || ''}`
                    };

                    await transporter.sendMail(testMailOptions);
                    testEmailsSent++;
                    console.log(`Test email #${testNumber} sent after ${currentGlobalIndex + 1} emails`);
                  } catch (testError) {
                    console.error('Failed to send test email:', testError);
                  }
                }
                
                return { success: true, recipient: emailData.recipient, messageId: info.messageId };
              } catch (error) {
                totalFailed++;
                console.error(`Failed to send to ${emailData.recipient}:`, error.message);
                return { success: false, recipient: emailData.recipient, error: error.message };
              }
            });

            await Promise.all(batchPromises);

            // Update progress
            await supabase
              .from('email_campaigns')
              .update({ sent_count: totalSent })
              .eq('id', campaignId);

            // Apply delay between batches
            if (sendingMode !== 'maximum' && i + batchSize < emails.length && delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }

          transporter.close();
          console.log(`SMTP connection closed for ${accountInfo.email}`);

        } else if (type === 'apps-script') {
          const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          let batchSize = 1;
          switch (sendingMode) {
            case 'maximum':
              batchSize = Math.min(emails.length, 10);
              break;
            case 'fast':
              batchSize = Math.min(emails.length, 5);
              break;
            default:
              batchSize = Math.min(emails.length, 3);
          }

          for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (emailData, localIndex) => {
              try {
                const currentGlobalIndex = globalEmailIndex + i + localIndex;
                
                const fromName = getRotatedFromName(rotation, currentGlobalIndex) || emailData.fromName || accountInfo.name;
                const subject = getRotatedSubject(rotation, currentGlobalIndex) || emailData.subject;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(scriptUrl, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'GoogleCloudFunction/1.0'
                  },
                  body: JSON.stringify({
                    to: emailData.recipient,
                    subject: subject,
                    htmlBody: emailData.htmlContent || '',
                    plainBody: emailData.textContent || '',
                    fromName: fromName,
                    fromAlias: emailData.fromEmail || accountInfo.email
                  }),
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                  const result = await response.json();
                  if (result.status === 'success') {
                    totalSent++;
                    console.log(`Apps Script sent to ${emailData.recipient}`);

                    // Send test email if needed
                    if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                      try {
                        const testNumber = Math.floor((currentGlobalIndex + 1) / testAfterConfig.testAfterCount);
                        const testSubject = `${testAfterConfig.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'} #${testNumber}`;
                        
                        await fetch(scriptUrl, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'User-Agent': 'GoogleCloudFunction/1.0'
                          },
                          body: JSON.stringify({
                            to: testAfterConfig.testAfterEmail,
                            subject: testSubject,
                            htmlBody: `<h2>📊 Test Email Delivery Report #${testNumber}</h2><p><strong>Campaign:</strong> ${campaignId}</p><p><strong>Emails Delivered:</strong> ${currentGlobalIndex + 1}</p><div style="border: 1px solid #ccc; padding: 10px;">${emailData.htmlContent || ''}</div>`,
                            plainBody: `TEST DELIVERY REPORT #${testNumber}\n\nCampaign: ${campaignId}\nEmails Delivered: ${currentGlobalIndex + 1}\n\n${emailData.textContent || ''}`,
                            fromName: fromName,
                            fromAlias: emailData.fromEmail || accountInfo.email
                          })
                        });

                        testEmailsSent++;
                        console.log(`Test email #${testNumber} sent via Apps Script`);
                      } catch (testError) {
                        console.error('Failed to send test email via Apps Script:', testError);
                      }
                    }

                    return { success: true, recipient: emailData.recipient };
                  } else {
                    throw new Error(result.message || 'Apps Script error');
                  }
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (error) {
                totalFailed++;
                console.error(`Apps Script failed for ${emailData.recipient}:`, error.message);
                return { success: false, recipient: emailData.recipient, error: error.message };
              }
            });

            await Promise.all(batchPromises);

            await supabase
              .from('email_campaigns')
              .update({ sent_count: totalSent })
              .eq('id', campaignId);

            if (sendingMode !== 'maximum' && i + batchSize < emails.length && delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

        globalEmailIndex += emails.length;

      } catch (accountError) {
        console.error(`Account ${accountId} failed:`, accountError.message);
        totalFailed += emails.length;
        
        await supabase
          .from('email_campaigns')
          .update({ 
            error_message: `Account ${accountInfo.email} failed: ${accountError.message}`,
            sent_count: totalSent
          })
          .eq('id', campaignId);
      }
    }

    // Final status update
    const finalStatus = totalSent > 0 ? 'sent' : 'failed';
    const updateData = { 
      status: finalStatus,
      sent_count: totalSent,
      completed_at: new Date().toISOString()
    };

    if (totalFailed > 0) {
      updateData.error_message = `${totalFailed} emails failed out of ${totalSent + totalFailed} total`;
    } else {
      updateData.error_message = null;
    }

    await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', campaignId);

    console.log(`Campaign completed: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails`);

    res.set(corsHeaders);
    res.json({ 
      success: true,
      completed: true,
      status: 'completed',
      sentCount: totalSent,
      failedCount: totalFailed,
      testEmailsSent: testEmailsSent,
      totalEmails: totalSent + totalFailed,
      successRate: totalSent > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0,
      campaignId,
      message: 'Campaign completed successfully',
      performance: {
        sendingMode: sendingMode,
        delayMs: delayMs,
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
        test_after_enabled: testAfterConfig.useTestAfter
      },
      features: {
        rotation: rotation,
        testAfter: testAfterConfig,
        testEmailsSent: testEmailsSent,
        sendingMode: sendingMode,
        actualDelayMs: delayMs
      }
    });

  } catch (error) {
    console.error('Critical error:', error);
    
    try {
      if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Campaign sender error: ${error.message}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', req.body.campaignId);
      }
    } catch (revertError) {
      console.error('Failed to revert status:', revertError);
    }

    res.set(corsHeaders);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error',
      campaignId: req.body?.campaignId || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});
