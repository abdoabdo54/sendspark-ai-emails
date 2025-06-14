const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced rotation helpers
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
function shouldSendTestEmail(emailIndex, testAfterConfig) {
  if (!testAfterConfig.useTestAfter || !testAfterConfig.testAfterEmail || !testAfterConfig.testAfterCount) {
    return false;
  }
  return (emailIndex + 1) % testAfterConfig.testAfterCount === 0;
}

functions.http('sendEmailCampaign', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    console.log('🚀 Google Cloud Function started - ENHANCED MODE with Perfect Account Distribution');
    console.log('Request method:', req.method);

    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {},
      rotation = {},
      testAfterConfig = {},
      customRateLimit = {}
    } = req.body || {};
    
    // Validate required fields
    if (!campaignId) {
      console.error('Missing campaignId in request');
      const error = new Error('Campaign ID is required');
      throw error;
    }

    if (!emailsByAccount || Object.keys(emailsByAccount).length === 0) {
      console.error('Missing or empty emailsByAccount in request');
      const error = new Error('Emails by account data is required and cannot be empty');
      throw error;
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      const error = new Error('Supabase credentials are required');
      throw error;
    }

    // Detect Zero Delay Mode
    const isZeroDelayMode = config.forceFastSend === true || config.zeroDelayMode === true || 
      (config.sendingMode === 'zero-delay');
    
    console.log(`🚀 STARTING ${isZeroDelayMode ? 'ZERO DELAY' : 'ENHANCED'} CAMPAIGN ${campaignId}`);
    console.log(`⚡ Processing ${Object.keys(emailsByAccount).length} accounts with PERFECT DISTRIBUTION`);
    console.log('Account distribution:', Object.keys(emailsByAccount).map(accountId => {
      const accountData = emailsByAccount[accountId];
      return `${accountData.accountInfo.name}: ${accountData.emails.length} emails`;
    }));

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    let totalSent = 0;
    let totalFailed = 0;
    let testEmailsSent = 0;
    const results = [];
    let globalEmailIndex = 0;

    if (isZeroDelayMode) {
      console.log('🚀 ZERO DELAY MODE ACTIVATED - UNLIMITED PARALLEL PROCESSING WITH PERFECT ACCOUNT DISTRIBUTION');
      
      // Zero Delay Mode: Full parallel processing across ALL accounts simultaneously
      const allAccountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
        console.log(`⚡ ZERO DELAY processing account ${accountId}:`, accountData.accountInfo);
        
        const accountType = accountData.type || 'smtp';
        const accountConfig = accountData.config || {};
        const emails = accountData.emails || [];
        const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
        
        console.log(`🚀 ZERO DELAY MODE: ${accountType} account ${accountInfo.email} processing ${emails.length} emails in UNLIMITED PARALLEL`);
        
        try {
          if (accountType === 'smtp') {
            // Enhanced SMTP configuration for zero delay mode
            const smtpHost = accountConfig.host;
            const smtpPort = accountConfig.port;
            const smtpUser = accountConfig.user || accountConfig.username;
            const smtpPass = accountConfig.pass || accountConfig.password;
            const smtpSecure = accountConfig.secure;
            
            if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
              throw new Error(`SMTP configuration incomplete for ${accountInfo.email}`);
            }

            // Create unlimited SMTP transporter for zero delay mode
            const port = parseInt(smtpPort);
            const isSecurePort = port === 465;
            
            const transporterConfig = {
              host: smtpHost,
              port: port,
              secure: isSecurePort,
              auth: {
                user: smtpUser,
                pass: smtpPass
              },
              tls: {
                rejectUnauthorized: false
              },
              connectionTimeout: 60000,
              greetingTimeout: 30000,
              socketTimeout: 60000,
              pool: true,
              maxConnections: 100,  // Unlimited connections for zero delay mode
              maxMessages: 999999,  // Unlimited messages for zero delay mode
              rateLimit: false      // Disable all rate limiting for zero delay mode
            };

            if (!isSecurePort) {
              transporterConfig.requireTLS = true;
            }

            console.log(`🚀 Creating UNLIMITED SMTP transporter for ${accountInfo.email}`);
            const transporter = nodemailer.createTransporter(transporterConfig);

            // Verify connection
            try {
              await transporter.verify();
              console.log(`✅ UNLIMITED SMTP connection verified for ${accountInfo.email}`);
            } catch (verifyError) {
              console.error(`💥 UNLIMITED SMTP verification ERROR for ${accountInfo.email}:`, verifyError.message);
              throw new Error(`SMTP connection failed for ${accountInfo.email}: ${verifyError.message}`);
            }

            // ZERO DELAY MODE: Send all emails in unlimited parallel with no restrictions
            console.log(`⚡ ZERO DELAY MODE: Sending ${emails.length} emails in UNLIMITED PARALLEL for ${accountInfo.email}`);

            const emailPromises = emails.map(async (emailData, index) => {
              try {
                if (!emailData.recipient || !emailData.subject) {
                  throw new Error('Missing recipient or subject');
                }

                // Apply rotation if enabled using GLOBAL index for proper distribution
                const currentGlobalIndex = globalEmailIndex + index;
                const fromName = getRotatedFromName(rotation, currentGlobalIndex) || emailData.fromName || accountInfo.name;
                const subject = getRotatedSubject(rotation, currentGlobalIndex) || emailData.subject;

                const mailOptions = {
                  from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                  to: emailData.recipient,
                  subject: subject,
                  html: emailData.htmlContent || '',
                  text: emailData.textContent || ''
                };

                console.log(`🚀 UNLIMITED SMTP sending to ${emailData.recipient} via ${accountInfo.email} (Global Index: ${currentGlobalIndex})`);
                
                const info = await transporter.sendMail(mailOptions);
                totalSent++;
                console.log(`✅ UNLIMITED SENT: ${emailData.recipient} via ${accountInfo.email} (MessageID: ${info.messageId})`);

                // Check if we should send a test email using global index
                if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                  try {
                    const testMailOptions = {
                      from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                      to: testAfterConfig.testAfterEmail,
                      subject: `UNLIMITED TEST - ${subject}`,
                      html: `<h2>Unlimited Zero Delay Test Email</h2><p>Sent after ${currentGlobalIndex + 1} emails delivered in UNLIMITED ZERO DELAY MODE with PERFECT ACCOUNT DISTRIBUTION.</p><hr/>${emailData.htmlContent || ''}`,
                      text: `UNLIMITED TEST - Sent after ${currentGlobalIndex + 1} emails delivered.\n\n${emailData.textContent || ''}`
                    };

                    await transporter.sendMail(testMailOptions);
                    testEmailsSent++;
                    console.log(`🧪 UNLIMITED TEST EMAIL SENT to ${testAfterConfig.testAfterEmail} after ${currentGlobalIndex + 1} emails`);
                  } catch (testError) {
                    console.error(`❌ Failed to send test email:`, testError);
                  }
                }
                
                return { success: true, recipient: emailData.recipient, messageId: info.messageId, account: accountInfo.email, rotation: { fromName, subject } };
              } catch (error) {
                totalFailed++;
                console.error(`❌ UNLIMITED FAILED: ${emailData.recipient} via ${accountInfo.email} - ${error.message}`);
                return { success: false, recipient: emailData.recipient, account: accountInfo.email, error: error.message };
              }
            });

            // Wait for all emails to complete in unlimited parallel
            const emailResults = await Promise.allSettled(emailPromises);
            
            // Update global index for next account
            globalEmailIndex += emails.length;
            
            emailResults.forEach(result => {
              if (result.status === 'fulfilled') {
                results.push(result.value);
              } else {
                totalFailed++;
                results.push({ success: false, error: result.reason?.message || 'Unknown error' });
              }
            });

            // Close SMTP connection
            try {
              transporter.close();
              console.log(`📪 UNLIMITED SMTP connection closed for ${accountInfo.email}`);
            } catch (closeError) {
              console.error('Error closing SMTP connection:', closeError);
            }

          } else if (accountType === 'apps-script') {
            // ZERO DELAY MODE for Apps Script with unlimited processing
            const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

            if (!scriptUrl) {
              throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
            }

            console.log(`⚡ UNLIMITED Apps Script ${accountInfo.email}: Sending ${emails.length} emails in UNLIMITED PARALLEL`);

            const emailPromises = emails.map(async (emailData, index) => {
              try {
                if (!emailData.recipient || !emailData.subject) {
                  throw new Error('Missing recipient or subject');
                }

                // Apply rotation if enabled using GLOBAL index
                const currentGlobalIndex = globalEmailIndex + index;
                const fromName = getRotatedFromName(rotation, currentGlobalIndex) || emailData.fromName || accountInfo.name;
                const subject = getRotatedSubject(rotation, currentGlobalIndex) || emailData.subject;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(scriptUrl, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'GoogleCloudFunction-Unlimited/1.0'
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
                    console.log(`✅ UNLIMITED SENT: ${emailData.recipient} via Apps Script ${accountInfo.email} (Global Index: ${currentGlobalIndex})`);

                    // Check if we should send a test email for Apps Script using global index
                    if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                      try {
                        const testResponse = await fetch(scriptUrl, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'User-Agent': 'GoogleCloudFunction-Unlimited/1.0'
                          },
                          body: JSON.stringify({
                            to: testAfterConfig.testAfterEmail,
                            subject: `UNLIMITED TEST - ${subject}`,
                            htmlBody: `<h2>Unlimited Zero Delay Test Email</h2><p>Sent after ${currentGlobalIndex + 1} emails delivered in UNLIMITED ZERO DELAY MODE with PERFECT ACCOUNT DISTRIBUTION.</p><hr/>${emailData.htmlContent || ''}`,
                            plainBody: `UNLIMITED TEST - Sent after ${currentGlobalIndex + 1} emails delivered.\n\n${emailData.textContent || ''}`,
                            fromName: fromName,
                            fromAlias: emailData.fromEmail || accountInfo.email
                          })
                        });

                        if (testResponse.ok) {
                          testEmailsSent++;
                          console.log(`🧪 UNLIMITED TEST EMAIL SENT to ${testAfterConfig.testAfterEmail} after ${currentGlobalIndex + 1} emails`);
                        }
                      } catch (testError) {
                        console.error(`❌ Failed to send test email via Apps Script:`, testError);
                      }
                    }

                    return { success: true, recipient: emailData.recipient, account: accountInfo.email, rotation: { fromName, subject } };
                  } else {
                    throw new Error(result.message || 'Apps Script error');
                  }
                } else {
                  const errorText = await response.text();
                  throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
              } catch (error) {
                totalFailed++;
                console.error(`❌ UNLIMITED FAILED: ${emailData.recipient} via ${accountInfo.email} - ${error.message}`);
                return { success: false, recipient: emailData.recipient, account: accountInfo.email, error: error.message };
              }
            });

            const emailResults = await Promise.all(emailPromises);
            
            // Update global index for next account
            globalEmailIndex += emails.length;
            
            results.push(...emailResults);

            console.log(`⚡ UNLIMITED Apps Script completed for ${accountInfo.email}`);
          } else {
            throw new Error(`Unsupported account type: ${accountType}`);
          }

        } catch (accountError) {
          console.error(`💥 UNLIMITED Account ${accountId} ERROR:`, accountError.message);
          
          const failedCount = emails.length;
          totalFailed += failedCount;

          emails.forEach(email => {
            results.push({
              success: false,
              recipient: email.recipient,
              account: accountInfo.email,
              error: accountError.message
            });
          });
        }
      });

      // Wait for all accounts to finish UNLIMITED processing
      console.log(`⚡ UNLIMITED MODE: Waiting for ${allAccountPromises.length} accounts to complete with PERFECT DISTRIBUTION...`);
      await Promise.all(allAccountPromises);

    } else {
      // Original enhanced mode with batching and delays
      const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
        console.log(`Processing account ${accountId}:`, accountData);
        
        const accountType = accountData.type || 'smtp';
        const accountConfig = accountData.config || {};
        const emails = accountData.emails || [];
        const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
        
        // Get rate limiting settings - use custom if available, otherwise use account defaults
        const useCustom = config.useCustomRateLimit && customRateLimit.emailsPerSecond && customRateLimit.delayInSeconds;
        const emailsPerSecond = useCustom ? customRateLimit.emailsPerSecond[accountId] : accountConfig.emails_per_second || 1;
        const delayInSeconds = useCustom ? customRateLimit.delayInSeconds[accountId] : 2;
        const maxEmailsPerHour = useCustom ? customRateLimit.maxEmailsPerHour[accountId] : accountConfig.emails_per_hour || 2000;
        
        console.log(`⚡ ENHANCED processing ${accountType} account: ${accountInfo.email} (${emails.length} emails)`);
        console.log(`📊 Rate limits for ${accountInfo.email}: ${emailsPerSecond} emails/sec, ${delayInSeconds}s delay, ${maxEmailsPerHour}/hour (Custom: ${useCustom})`);
        
        try {
          if (accountType === 'smtp') {
            // Enhanced SMTP configuration validation
            const smtpHost = accountConfig.host;
            const smtpPort = accountConfig.port;
            const smtpUser = accountConfig.user || accountConfig.username;
            const smtpPass = accountConfig.pass || accountConfig.password;
            const smtpSecure = accountConfig.secure;
            
            console.log(`🔍 SMTP Config Debug for ${accountInfo.email}:`, {
              host: smtpHost,
              port: smtpPort,
              user: smtpUser ? '***' : 'MISSING',
              pass: smtpPass ? '***' : 'MISSING',
              secure: smtpSecure
            });
            
            if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
              throw new Error(`SMTP configuration incomplete for ${accountInfo.email}. Missing: ${
                [
                  !smtpHost && 'host',
                  !smtpPort && 'port', 
                  !smtpUser && 'username',
                  !smtpPass && 'password'
                ].filter(Boolean).join(', ')
              }`);
            }

            // Create enhanced SMTP transporter configuration
            const port = parseInt(smtpPort);
            const isSecurePort = port === 465;
            
            const transporterConfig = {
              host: smtpHost,
              port: port,
              secure: isSecurePort,
              auth: {
                user: smtpUser,
                pass: smtpPass
              },
              tls: {
                rejectUnauthorized: false
              },
              connectionTimeout: 60000,
              greetingTimeout: 30000,
              socketTimeout: 60000,
              pool: true,
              maxConnections: 1,
              maxMessages: 100
            };

            if (!isSecurePort) {
              transporterConfig.requireTLS = true;
            }

            console.log(`📧 Creating enhanced SMTP transporter for ${accountInfo.email}`);

            const transporter = nodemailer.createTransport(transporterConfig);

            // Enhanced connection verification
            try {
              console.log(`🔍 Verifying SMTP connection for ${accountInfo.email}...`);
              await transporter.verify();
              console.log(`✅ SMTP connection verified for ${accountInfo.email}`);
            } catch (verifyError) {
              console.error(`💥 SMTP verification CRITICAL ERROR for ${accountInfo.email}:`, verifyError.message);
              throw new Error(`SMTP connection failed for ${accountInfo.email}: ${verifyError.message}`);
            }

            // Calculate batch size based on emails per second
            const batchSize = Math.max(1, emailsPerSecond);
            const batches = [];
            
            for (let i = 0; i < emails.length; i += batchSize) {
              batches.push(emails.slice(i, i + batchSize));
            }

            console.log(`⚡ ENHANCED SMTP ${accountInfo.email}: ${batches.length} batches of ${batchSize} emails each with ${delayInSeconds}s delay`);

            // Process batches with custom delay
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const batch = batches[batchIndex];
              
              const batchResults = await Promise.allSettled(
                batch.map(async (emailData, localIndex) => {
                  try {
                    if (!emailData.recipient || !emailData.subject) {
                      throw new Error('Missing recipient or subject');
                    }

                    // Calculate global email index for rotation
                    const globalEmailIndex = (batchIndex * batchSize) + localIndex + totalSent;

                    // Apply rotation if enabled
                    const fromName = getRotatedFromName(rotation, globalEmailIndex) || emailData.fromName || accountInfo.name;
                    const subject = getRotatedSubject(rotation, globalEmailIndex) || emailData.subject;

                    const mailOptions = {
                      from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                      to: emailData.recipient,
                      subject: subject,
                      html: emailData.htmlContent || '',
                      text: emailData.textContent || ''
                    };

                    console.log(`📤 Sending ENHANCED SMTP email to ${emailData.recipient} via ${accountInfo.email} (From: ${fromName}, Subject: ${subject})`);
                    
                    const info = await transporter.sendMail(mailOptions);
                    totalSent++;
                    console.log(`✅ ENHANCED SMTP SENT: ${emailData.recipient} via ${accountInfo.email} (MessageID: ${info.messageId})`);

                    // Check if we should send a test email
                    if (shouldSendTestEmail(globalEmailIndex, testAfterConfig)) {
                      try {
                        const testMailOptions = {
                          from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                          to: testAfterConfig.testAfterEmail,
                          subject: `TEST AFTER ${testAfterConfig.testAfterCount} - ${subject}`,
                          html: `<h2>Test Email Notification</h2><p>This is test email #${Math.floor(globalEmailIndex / testAfterConfig.testAfterCount) + 1}</p><p>Sent after ${globalEmailIndex + 1} emails delivered.</p><hr/>${emailData.htmlContent || ''}`,
                          text: `TEST AFTER ${testAfterConfig.testAfterCount} - This is test email sent after ${globalEmailIndex + 1} emails delivered.\n\n${emailData.textContent || ''}`
                        };

                        await transporter.sendMail(testMailOptions);
                        testEmailsSent++;
                        console.log(`🧪 TEST EMAIL SENT to ${testAfterConfig.testAfterEmail} after ${globalEmailIndex + 1} emails`);
                      } catch (testError) {
                        console.error(`❌ Failed to send test email:`, testError);
                      }
                    }
                    
                    return { success: true, recipient: emailData.recipient, messageId: info.messageId, rotation: { fromName, subject } };
                  } catch (error) {
                    totalFailed++;
                    console.error(`❌ ENHANCED SMTP FAILED: ${emailData.recipient} - ${error.message}`);
                    return { success: false, recipient: emailData.recipient, error: error.message };
                  }
                })
              );

              batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                  results.push(result.value);
                } else {
                  totalFailed++;
                  results.push({ success: false, error: result.reason?.message || 'Unknown error' });
                }
              });

              // Real-time progress updates every batch
              try {
                await supabase
                  .from('email_campaigns')
                  .update({ sent_count: totalSent })
                  .eq('id', campaignId);
              } catch (updateError) {
                console.error('Failed to update progress:', updateError);
              }
                
              console.log(`⚡ ENHANCED SMTP Batch ${batchIndex + 1}/${batches.length}: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails sent`);
              
              // Apply custom delay between batches (convert seconds to milliseconds)
              if (batchIndex < batches.length - 1) {
                const delayMs = delayInSeconds * 1000;
                console.log(`⏱️ Waiting ${delayInSeconds} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }

            // Close SMTP connection
            try {
              transporter.close();
              console.log(`📪 SMTP connection closed for ${accountInfo.email}`);
            } catch (closeError) {
              console.error('Error closing SMTP connection:', closeError);
            }

          } else if (accountType === 'apps-script') {
            // Enhanced Apps Script handling with rotation and custom rate limiting
            const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

            if (!scriptUrl) {
              throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
            }

            const batchSize = Math.max(1, emailsPerSecond);
            const batches = [];
            
            for (let i = 0; i < emails.length; i += batchSize) {
              batches.push(emails.slice(i, i + batchSize));
            }

            console.log(`⚡ ENHANCED Apps Script ${accountInfo.email}: ${batches.length} batches with ${delayInSeconds}s delay`);

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const batch = batches[batchIndex];
              
              const batchPromises = batch.map(async (emailData, localIndex) => {
                try {
                  if (!emailData.recipient || !emailData.subject) {
                    throw new Error('Missing recipient or subject');
                  }

                  // Calculate global email index for rotation
                  const globalEmailIndex = (batchIndex * batchSize) + localIndex + totalSent;

                  // Apply rotation if enabled
                  const fromName = getRotatedFromName(rotation, globalEmailIndex) || emailData.fromName || accountInfo.name;
                  const subject = getRotatedSubject(rotation, globalEmailIndex) || emailData.subject;

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
                      console.log(`✅ ENHANCED SENT: ${emailData.recipient} via Apps Script (From: ${fromName}, Subject: ${subject})`);

                      // Check if we should send a test email for Apps Script
                      if (shouldSendTestEmail(globalEmailIndex, testAfterConfig)) {
                        try {
                          const testResponse = await fetch(scriptUrl, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'User-Agent': 'GoogleCloudFunction/1.0'
                            },
                            body: JSON.stringify({
                              to: testAfterConfig.testAfterEmail,
                              subject: `TEST AFTER ${testAfterConfig.testAfterCount} - ${subject}`,
                              htmlBody: `<h2>Test Email Notification</h2><p>This is test email #${Math.floor(globalEmailIndex / testAfterConfig.testAfterCount) + 1}</p><p>Sent after ${globalEmailIndex + 1} emails delivered.</p><hr/>${emailData.htmlContent || ''}`,
                              plainBody: `TEST AFTER ${testAfterConfig.testAfterCount} - This is test email sent after ${globalEmailIndex + 1} emails delivered.\n\n${emailData.textContent || ''}`,
                              fromName: fromName,
                              fromAlias: emailData.fromEmail || accountInfo.email
                            })
                          });

                          if (testResponse.ok) {
                            testEmailsSent++;
                            console.log(`🧪 TEST EMAIL SENT to ${testAfterConfig.testAfterEmail} after ${globalEmailIndex + 1} emails via Apps Script`);
                          }
                        } catch (testError) {
                          console.error(`❌ Failed to send test email via Apps Script:`, testError);
                        }
                      }

                      return { success: true, recipient: emailData.recipient, rotation: { fromName, subject } };
                    } else {
                      throw new Error(result.message || 'Apps Script error');
                    }
                  } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                  }
                } catch (error) {
                  totalFailed++;
                  console.error(`❌ ENHANCED FAILED: ${emailData.recipient} - ${error.message}`);
                  return { success: false, recipient: emailData.recipient, error: error.message };
                }
              });

              const batchResults = await Promise.all(batchPromises);
              results.push(...batchResults);

              // Real-time progress updates
              try {
                await supabase
                  .from('email_campaigns')
                  .update({ sent_count: totalSent })
                  .eq('id', campaignId);
              } catch (updateError) {
                console.error('Failed to update progress:', updateError);
              }

              console.log(`⚡ ENHANCED Apps Script batch ${batchIndex + 1}/${batches.length} completed`);
              
              // Apply custom delay between batches
              if (batchIndex < batches.length - 1) {
                const delayMs = delayInSeconds * 1000;
                console.log(`⏱️ Waiting ${delayInSeconds} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }
          } else {
            throw new Error(`Unsupported account type: ${accountType}`);
          }

        } catch (accountError) {
          console.error(`💥 Account ${accountId} CRITICAL error:`, accountError.message);
          
          const failedCount = emails.length;
          totalFailed += failedCount;
          
          try {
            await supabase
              .from('email_campaigns')
              .update({ 
                error_message: `Account ${accountInfo.email} failed: ${accountError.message}`,
                sent_count: totalSent
              })
              .eq('id', campaignId);
          } catch (updateError) {
            console.error('Failed to update error status:', updateError);
          }

          emails.forEach(email => {
            results.push({
              success: false,
              recipient: email.recipient,
              error: accountError.message
            });
          });
        }
      });

      // Wait for all accounts to finish ENHANCED MAXIMUM SPEED processing
      console.log(`⚡ Waiting for ${accountPromises.length} accounts to complete ENHANCED processing...`);
      await Promise.all(accountPromises);

    }

    const modeType = isZeroDelayMode ? 'UNLIMITED ZERO DELAY MODE' : 'ENHANCED MODE';
    console.log(`🎉 ${modeType} CAMPAIGN COMPLETED with PERFECT ACCOUNT DISTRIBUTION: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails sent`);

    // Log final account distribution summary
    console.log('📊 FINAL ACCOUNT DISTRIBUTION SUMMARY:');
    const accountSummary = {};
    results.forEach(result => {
      if (result.account) {
        accountSummary[result.account] = (accountSummary[result.account] || 0) + 1;
      }
    });
    Object.entries(accountSummary).forEach(([account, count]) => {
      console.log(`   ${account}: ${count} emails processed`);
    });

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
      message: `${modeType} campaign completed successfully with PERFECT ACCOUNT DISTRIBUTION${isZeroDelayMode ? ' at unlimited speed' : ' with enhanced features'}`,
      mode: isZeroDelayMode ? 'unlimited-zero-delay' : 'enhanced',
      accountDistribution: accountSummary,
      performance: {
        zeroDelayMode: isZeroDelayMode,
        perfectDistribution: true,
        accountRotation: true,
        maxSpeed: isZeroDelayMode,
        ultraFast: isZeroDelayMode,
        unlimited: isZeroDelayMode,
        parallel_processing: isZeroDelayMode ? 'unlimited_parallel' : 'batched',
        optimized_batching: !isZeroDelayMode,
        record_time: isZeroDelayMode,
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
        test_after_enabled: testAfterConfig.useTestAfter,
        custom_rate_limit_used: config.useCustomRateLimit && !isZeroDelayMode
      },
      features: {
        rotation: rotation,
        testAfter: testAfterConfig,
        testEmailsSent: testEmailsSent,
        customRateLimit: config.useCustomRateLimit && !isZeroDelayMode ? customRateLimit : null,
        zeroDelaySettings: isZeroDelayMode ? {
          emailsPerSecond: 999999,
          delayInSeconds: 0,
          parallelProcessing: true,
          noBatching: true,
          unlimited: true,
          noRateLimit: true,
          perfectAccountDistribution: true
        } : null
      },
      sampleResults: results.slice(0, 10) // Show more samples to verify distribution
    });

  } catch (error) {
    console.error('💥 CAMPAIGN CRITICAL ERROR:', error);
    console.error('Error stack:', error.stack);

    res.set(corsHeaders);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error',
      campaignId: req.body?.campaignId || 'unknown',
      timestamp: new Date().toISOString(),
      zeroDelayMode: req.body?.config?.zeroDelayMode || false,
      stack: error.stack
    });
  }
});
