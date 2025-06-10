
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

// Enhanced test after email helper - FIXED LOGIC
function shouldSendTestEmail(globalEmailIndex, testAfterConfig) {
  if (!testAfterConfig.useTestAfter || !testAfterConfig.testAfterEmail || !testAfterConfig.testAfterCount) {
    return false;
  }
  
  // Send test email every testAfterCount emails (1-based counting)
  const emailNumber = globalEmailIndex + 1;
  const shouldSend = emailNumber > 0 && (emailNumber % testAfterConfig.testAfterCount === 0);
  
  console.log(`📧 Test After Check: Email ${emailNumber}, Test every ${testAfterConfig.testAfterCount}, Should send: ${shouldSend}`);
  return shouldSend;
}

// Enhanced delay calculation based on sending mode
function calculateDelayMs(config) {
  const sendingMode = config.sendingMode || 'controlled';
  
  switch (sendingMode) {
    case 'maximum':
      return 0; // No delay
    case 'fast':
      return 100; // 100ms = 10 emails per second
    case 'controlled':
      if (config.useCustomDelay) {
        return Math.max(0, config.customDelayMs || 1000);
      }
      const emailsPerSecond = config.emailsPerSecond || 1;
      return Math.max(0, (1000 / emailsPerSecond));
    default:
      return 1000; // 1 second default
  }
}

functions.http('sendEmailCampaign', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    console.log('🚀 Enhanced Google Cloud Function started - FLEXIBLE RATE LIMITING with Test After');
    console.log('Request method:', req.method);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));

    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {},
      rotation = {},
      testAfterConfig = {}
    } = req.body || {};
    
    // Validate required fields
    if (!campaignId) {
      console.error('Missing campaignId in request');
      throw new Error('Campaign ID is required');
    }

    if (!emailsByAccount || Object.keys(emailsByAccount).length === 0) {
      console.error('Missing or empty emailsByAccount in request');
      throw new Error('Emails by account data is required and cannot be empty');
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      throw new Error('Supabase credentials are required');
    }

    console.log(`🚀 STARTING ENHANCED FLEXIBLE RATE CAMPAIGN ${campaignId}`);
    console.log(`⚡ Processing ${Object.keys(emailsByAccount).length} accounts with advanced features`);
    console.log('Config:', config);
    console.log('Rotation config:', rotation);
    console.log('Test after config:', testAfterConfig);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate delay based on configuration
    const delayMs = calculateDelayMs(config);
    const sendingMode = config.sendingMode || 'controlled';
    
    console.log(`⚡ SENDING MODE: ${sendingMode}, Delay: ${delayMs}ms`);

    // Ensure campaign is marked as sending
    try {
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', campaignId);
    } catch (supabaseError) {
      console.error('Failed to update campaign status:', supabaseError);
    }

    let totalSent = 0;
    let totalFailed = 0;
    let testEmailsSent = 0;
    let globalEmailIndex = 0; // Track global email index for test after
    const results = [];

    // Process all accounts based on sending mode
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      console.log(`Processing account ${accountId}:`, accountData);
      
      const accountType = accountData.type || 'smtp';
      const accountConfig = accountData.config || {};
      const emails = accountData.emails || [];
      const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
      
      console.log(`⚡ FLEXIBLE RATE processing ${accountType} account: ${accountInfo.email} (${emails.length} emails)`);
      
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
            maxConnections: sendingMode === 'maximum' ? 5 : 1,
            maxMessages: sendingMode === 'maximum' ? 1000 : 100
          };

          if (!isSecurePort) {
            transporterConfig.requireTLS = true;
          }

          console.log(`📧 Creating SMTP transporter for ${accountInfo.email} with mode: ${sendingMode}`);

          const transporter = nodemailer.createTransporter(transporterConfig);

          // Enhanced connection verification
          try {
            console.log(`🔍 Verifying SMTP connection for ${accountInfo.email}...`);
            await transporter.verify();
            console.log(`✅ SMTP connection verified for ${accountInfo.email}`);
          } catch (verifyError) {
            console.error(`💥 SMTP verification CRITICAL ERROR for ${accountInfo.email}:`, verifyError.message);
            throw new Error(`SMTP connection failed for ${accountInfo.email}: ${verifyError.message}`);
          }

          // Determine batch size based on sending mode
          let batchSize;
          switch (sendingMode) {
            case 'maximum':
              batchSize = Math.min(emails.length, 10); // Send all or max 10 at once
              break;
            case 'fast':
              batchSize = Math.min(emails.length, 5);
              break;
            case 'controlled':
              batchSize = Math.min(emails.length, config.burstSize || 1);
              break;
            default:
              batchSize = 2;
          }

          const batches = [];
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ FLEXIBLE SMTP ${accountInfo.email}: ${batches.length} batches of ${batchSize} emails each`);

          // Process batches with flexible timing
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            // For maximum speed, process all emails in parallel
            const processFunction = sendingMode === 'maximum' ? Promise.all : Promise.allSettled;
            
            const batchResults = await processFunction(
              batch.map(async (emailData, localIndex) => {
                try {
                  if (!emailData.recipient || (!emailData.subject && !rotation.useSubjectRotation)) {
                    throw new Error('Missing recipient or subject');
                  }

                  // Calculate current global email index
                  const currentGlobalIndex = globalEmailIndex + (batchIndex * batchSize) + localIndex;

                  // Apply rotation if enabled
                  const fromName = getRotatedFromName(rotation, currentGlobalIndex) || emailData.fromName || accountInfo.name;
                  const subject = getRotatedSubject(rotation, currentGlobalIndex) || emailData.subject;

                  const mailOptions = {
                    from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                    to: emailData.recipient,
                    subject: subject,
                    html: emailData.htmlContent || '',
                    text: emailData.textContent || ''
                  };

                  console.log(`📤 Sending SMTP email ${currentGlobalIndex + 1} to ${emailData.recipient} via ${accountInfo.email} (From: ${fromName}, Subject: ${subject})`);
                  
                  const info = await transporter.sendMail(mailOptions);
                  totalSent++;
                  console.log(`✅ SMTP SENT: ${emailData.recipient} via ${accountInfo.email} (MessageID: ${info.messageId})`);

                  // FIXED: Check if we should send a test email with correct index
                  if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                    try {
                      const testNumber = Math.floor((currentGlobalIndex + 1) / testAfterConfig.testAfterCount);
                      const testSubject = `${testAfterConfig.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'} #${testNumber} - After ${currentGlobalIndex + 1} emails`;
                      
                      const testMailOptions = {
                        from: `${fromName} <${emailData.fromEmail || accountInfo.email}>`,
                        to: testAfterConfig.testAfterEmail,
                        subject: testSubject,
                        html: `
                          <h2>📊 Test Email Delivery Report #${testNumber}</h2>
                          <p><strong>Campaign:</strong> ${campaignId}</p>
                          <p><strong>Emails Delivered:</strong> ${currentGlobalIndex + 1}</p>
                          <p><strong>Test Frequency:</strong> Every ${testAfterConfig.testAfterCount} emails</p>
                          <p><strong>Account Used:</strong> ${accountInfo.email}</p>
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
                        text: `
TEST DELIVERY REPORT #${testNumber}

Campaign: ${campaignId}
Emails Delivered: ${currentGlobalIndex + 1}
Test Frequency: Every ${testAfterConfig.testAfterCount} emails
Account Used: ${accountInfo.email}
Timestamp: ${new Date().toISOString()}

Original Email Sample:
From: ${fromName}
Subject: ${subject}
To: ${emailData.recipient}

${emailData.textContent || ''}
                        `
                      };

                      await transporter.sendMail(testMailOptions);
                      testEmailsSent++;
                      console.log(`🧪 TEST EMAIL #${testNumber} SENT to ${testAfterConfig.testAfterEmail} after ${currentGlobalIndex + 1} emails delivered`);
                    } catch (testError) {
                      console.error(`❌ Failed to send test email:`, testError);
                    }
                  }
                  
                  return { success: true, recipient: emailData.recipient, messageId: info.messageId, rotation: { fromName, subject } };
                } catch (error) {
                  totalFailed++;
                  console.error(`❌ SMTP FAILED: ${emailData.recipient} - ${error.message}`);
                  return { success: false, recipient: emailData.recipient, error: error.message };
                }
              })
            );

            // Handle results based on processing mode
            if (sendingMode === 'maximum') {
              results.push(...batchResults);
            } else {
              batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                  results.push(result.value);
                } else {
                  totalFailed++;
                  results.push({ success: false, error: result.reason?.message || 'Unknown error' });
                }
              });
            }

            // Update global email index
            globalEmailIndex += batch.length;

            // Real-time progress updates every batch
            try {
              await supabase
                .from('email_campaigns')
                .update({ sent_count: totalSent })
                .eq('id', campaignId);
            } catch (updateError) {
              console.error('Failed to update progress:', updateError);
            }
              
            console.log(`⚡ Batch ${batchIndex + 1}/${batches.length}: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails`);
            
            // Apply delay between batches (except for maximum speed mode)
            if (sendingMode !== 'maximum' && batchIndex < batches.length - 1 && delayMs > 0) {
              console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
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
          // Enhanced Apps Script handling with flexible rate limiting
          const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          // Determine batch size based on sending mode
          let batchSize;
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

          const batches = [];
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ FLEXIBLE Apps Script ${accountInfo.email}: ${batches.length} batches`);

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const batchPromises = batch.map(async (emailData, localIndex) => {
              try {
                if (!emailData.recipient || (!emailData.subject && !rotation.useSubjectRotation)) {
                  throw new Error('Missing recipient or subject');
                }

                // Calculate current global email index
                const currentGlobalIndex = globalEmailIndex + (batchIndex * batchSize) + localIndex;

                // Apply rotation if enabled
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
                    console.log(`✅ Apps Script SENT: ${emailData.recipient} (From: ${fromName}, Subject: ${subject})`);

                    // FIXED: Check if we should send a test email for Apps Script
                    if (shouldSendTestEmail(currentGlobalIndex, testAfterConfig)) {
                      try {
                        const testNumber = Math.floor((currentGlobalIndex + 1) / testAfterConfig.testAfterCount);
                        const testSubject = `${testAfterConfig.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'} #${testNumber} - After ${currentGlobalIndex + 1} emails`;
                        
                        const testResponse = await fetch(scriptUrl, {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'User-Agent': 'GoogleCloudFunction/1.0'
                          },
                          body: JSON.stringify({
                            to: testAfterConfig.testAfterEmail,
                            subject: testSubject,
                            htmlBody: `
                              <h2>📊 Test Email Delivery Report #${testNumber}</h2>
                              <p><strong>Campaign:</strong> ${campaignId}</p>
                              <p><strong>Emails Delivered:</strong> ${currentGlobalIndex + 1}</p>
                              <p><strong>Test Frequency:</strong> Every ${testAfterConfig.testAfterCount} emails</p>
                              <p><strong>Account Used:</strong> ${accountInfo.email}</p>
                              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                              <hr/>
                              <h3>Original Email Sample:</h3>
                              <div style="border: 1px solid #ccc; padding: 10px;">${emailData.htmlContent || ''}</div>
                            `,
                            plainBody: `TEST DELIVERY REPORT #${testNumber}\n\nCampaign: ${campaignId}\nEmails Delivered: ${currentGlobalIndex + 1}\nTest Frequency: Every ${testAfterConfig.testAfterCount} emails\n\n${emailData.textContent || ''}`,
                            fromName: fromName,
                            fromAlias: emailData.fromEmail || accountInfo.email
                          })
                        });

                        if (testResponse.ok) {
                          testEmailsSent++;
                          console.log(`🧪 TEST EMAIL #${testNumber} SENT to ${testAfterConfig.testAfterEmail} after ${currentGlobalIndex + 1} emails via Apps Script`);
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
                console.error(`❌ Apps Script FAILED: ${emailData.recipient} - ${error.message}`);
                return { success: false, recipient: emailData.recipient, error: error.message };
              }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Update global email index
            globalEmailIndex += batch.length;

            // Real-time progress updates
            try {
              await supabase
                .from('email_campaigns')
                .update({ sent_count: totalSent })
                .eq('id', campaignId);
            } catch (updateError) {
              console.error('Failed to update progress:', updateError);
            }

            console.log(`⚡ Apps Script batch ${batchIndex + 1}/${batches.length} completed`);
            
            // Apply delay between batches
            if (sendingMode !== 'maximum' && batchIndex < batches.length - 1 && delayMs > 0) {
              console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
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

    // Wait for all accounts to finish processing
    console.log(`⚡ Waiting for ${accountPromises.length} accounts to complete processing...`);
    await Promise.all(accountPromises);

    // Final campaign completion with enhanced stats
    const finalStatus = totalSent > 0 ? 'sent' : 'failed';
    const updateData = { 
      status: finalStatus,
      sent_count: totalSent,
      completed_at: new Date().toISOString()
    };

    if (totalFailed > 0) {
      updateData.error_message = `${totalFailed} emails failed to send out of ${totalSent + totalFailed} total`;
    } else {
      updateData.error_message = null;
    }

    try {
      await supabase
        .from('email_campaigns')
        .update(updateData)
        .eq('id', campaignId);
    } catch (updateError) {
      console.error('Failed to update final status:', updateError);
    }

    console.log(`🎉 FLEXIBLE RATE CAMPAIGN COMPLETED: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails sent`);

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
      message: 'FLEXIBLE RATE campaign completed successfully with rotation and test-after features',
      performance: {
        sendingMode: sendingMode,
        delayMs: delayMs,
        flexible_rate_limiting: true,
        parallel_processing: sendingMode === 'maximum',
        optimized_batching: true,
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
        test_after_enabled: testAfterConfig.useTestAfter
      },
      features: {
        rotation: rotation,
        testAfter: testAfterConfig,
        testEmailsSent: testEmailsSent,
        sendingMode: sendingMode,
        actualDelayMs: delayMs
      },
      sampleResults: results.slice(0, 5)
    });

  } catch (error) {
    console.error('💥 FLEXIBLE RATE CRITICAL ERROR:', error);
    console.error('Error stack:', error.stack);
    
    try {
      if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Flexible rate sender error: ${error.message}`,
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
      timestamp: new Date().toISOString(),
      flexibleRateMode: true,
      stack: error.stack
    });
  }
});
