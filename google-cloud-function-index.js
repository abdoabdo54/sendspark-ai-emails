
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
    console.log('🚀 Google Cloud Function started - MAXIMUM SPEED MODE with Enhanced Features');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
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

    console.log(`🚀 STARTING ENHANCED MAXIMUM SPEED CAMPAIGN ${campaignId}`);
    console.log(`⚡ Processing ${Object.keys(emailsByAccount).length} accounts with rotation and test-after features`);
    console.log('Rotation config:', rotation);
    console.log('Test after config:', testAfterConfig);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const results = [];

    // Process all accounts in MAXIMUM PARALLEL for ultra speed
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      console.log(`Processing account ${accountId}:`, accountData);
      
      const accountType = accountData.type || 'smtp';
      const accountConfig = accountData.config || {};
      const emails = accountData.emails || [];
      const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
      
      console.log(`⚡ ENHANCED MAXIMUM SPEED processing ${accountType} account: ${accountInfo.email} (${emails.length} emails)`);
      
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

          // Send emails in small batches for SMTP reliability
          const batchSize = 2;
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ ENHANCED SMTP ${accountInfo.email}: ${batches.length} batches of ${batchSize} emails each`);

          // Process batches sequentially for SMTP reliability
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
            
            if (batchIndex < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
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
          // Enhanced Apps Script handling with rotation
          const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          const batchSize = 5;
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ ENHANCED Apps Script ${accountInfo.email}: ${batches.length} batches at MAXIMUM SPEED`);

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
            
            if (batchIndex < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
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
    console.log(`⚡ Waiting for ${accountPromises.length} accounts to complete ENHANCED MAXIMUM SPEED processing...`);
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

    console.log(`🎉 ENHANCED MAXIMUM SPEED CAMPAIGN COMPLETED: ${totalSent} sent, ${totalFailed} failed, ${testEmailsSent} test emails sent in RECORD TIME`);

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
      message: 'ENHANCED MAXIMUM SPEED campaign completed successfully with rotation and test-after features',
      performance: {
        maxSpeed: true,
        ultraFast: true,
        parallel_processing: true,
        optimized_batching: true,
        record_time: true,
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
        test_after_enabled: testAfterConfig.useTestAfter
      },
      features: {
        rotation: rotation,
        testAfter: testAfterConfig,
        testEmailsSent: testEmailsSent
      },
      sampleResults: results.slice(0, 5)
    });

  } catch (error) {
    console.error('💥 ENHANCED MAXIMUM SPEED CRITICAL ERROR:', error);
    console.error('Error stack:', error.stack);
    
    try {
      if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Enhanced maximum speed error: ${error.message}`,
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
      enhancedMaxSpeedMode: true,
      stack: error.stack
    });
  }
});
