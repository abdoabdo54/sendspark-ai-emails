
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
          const { host, port, user, pass } = accountConfig;
          
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
            socketTimeout: 60000
          };

          const transporter = nodemailer.createTransporter(transporterConfig);
          await transporter.verify();
          console.log(`SMTP connection verified for ${accountInfo.email}`);

          // Process emails one by one
          for (let i = 0; i < emails.length; i++) {
            const emailData = emails[i];
            try {
              // Apply rotation
              const fromName = getRotatedFromName(rotation, globalEmailIndex) || emailData.fromName || accountInfo.name;
              const subject = getRotatedSubject(rotation, globalEmailIndex) || emailData.subject;

              const mailOptions = {
                from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                to: emailData.recipient,
                subject: subject,
                html: emailData.htmlContent || '',
                text: emailData.textContent || ''
              };

              console.log(`Sending email ${globalEmailIndex + 1} to ${emailData.recipient}`);
              
              await transporter.sendMail(mailOptions);
              totalSent++;
              
              // Send test email if needed
              if (shouldSendTestEmail(globalEmailIndex, testAfterConfig)) {
                try {
                  const testNumber = Math.floor((globalEmailIndex + 1) / testAfterConfig.testAfterCount);
                  const testSubject = `${testAfterConfig.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'} #${testNumber}`;
                  
                  const testMailOptions = {
                    from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                    to: testAfterConfig.testAfterEmail,
                    subject: testSubject,
                    html: `
                      <h2>📊 Test Email Delivery Report #${testNumber}</h2>
                      <p><strong>Campaign:</strong> ${campaignId}</p>
                      <p><strong>Emails Delivered:</strong> ${globalEmailIndex + 1}</p>
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
                    text: `TEST DELIVERY REPORT #${testNumber}\n\nCampaign: ${campaignId}\nEmails Delivered: ${globalEmailIndex + 1}\nTest Frequency: Every ${testAfterConfig.testAfterCount} emails\n\n${emailData.textContent || ''}`
                  };

                  await transporter.sendMail(testMailOptions);
                  testEmailsSent++;
                  console.log(`Test email #${testNumber} sent after ${globalEmailIndex + 1} emails`);
                } catch (testError) {
                  console.error('Failed to send test email:', testError);
                }
              }
              
            } catch (error) {
              totalFailed++;
              console.error(`Failed to send to ${emailData.recipient}:`, error.message);
            }

            globalEmailIndex++;
            
            // Apply delay between emails
            if (delayMs > 0 && i < emails.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }

          transporter.close();
          console.log(`SMTP connection closed for ${accountInfo.email}`);

        } else if (type === 'apps-script') {
          const scriptUrl = accountConfig.script_url || accountConfig.exec_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          // Process emails one by one
          for (let i = 0; i < emails.length; i++) {
            const emailData = emails[i];
            try {
              const fromName = getRotatedFromName(rotation, globalEmailIndex) || emailData.fromName || accountInfo.name;
              const subject = getRotatedSubject(rotation, globalEmailIndex) || emailData.subject;

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
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                  totalSent++;
                  console.log(`Apps Script sent to ${emailData.recipient}`);

                  // Send test email if needed
                  if (shouldSendTestEmail(globalEmailIndex, testAfterConfig)) {
                    try {
                      const testNumber = Math.floor((globalEmailIndex + 1) / testAfterConfig.testAfterCount);
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
                          htmlBody: `<h2>📊 Test Email Delivery Report #${testNumber}</h2><p><strong>Campaign:</strong> ${campaignId}</p><p><strong>Emails Delivered:</strong> ${globalEmailIndex + 1}</p><div style="border: 1px solid #ccc; padding: 10px;">${emailData.htmlContent || ''}</div>`,
                          plainBody: `TEST DELIVERY REPORT #${testNumber}\n\nCampaign: ${campaignId}\nEmails Delivered: ${globalEmailIndex + 1}\n\n${emailData.textContent || ''}`,
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
                } else {
                  throw new Error(result.message || 'Apps Script error');
                }
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error) {
              totalFailed++;
              console.error(`Apps Script failed for ${emailData.recipient}:`, error.message);
            }

            globalEmailIndex++;
            
            // Apply delay between emails
            if (delayMs > 0 && i < emails.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

      } catch (accountError) {
        console.error(`Account ${accountId} failed:`, accountError.message);
        totalFailed += emails.length;
        globalEmailIndex += emails.length;
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
      message: 'Campaign completed successfully'
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
