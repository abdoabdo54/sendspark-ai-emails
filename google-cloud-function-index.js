
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

functions.http('sendEmailCampaign', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    console.log('🚀 Google Cloud Function started with Dual Sending Modes');
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
      sendingMode = 'controlled'
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

    console.log(`🚀 STARTING ${sendingMode.toUpperCase()} SENDING MODE for campaign ${campaignId}`);
    console.log(`⚡ Processing ${Object.keys(emailsByAccount).length} accounts with rotation features`);
    console.log('Sending mode:', sendingMode);
    console.log('Rotation config:', rotation);

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
    const results = [];

    // Calculate delay based on sending mode
    const getEmailDelay = (sendingMode, accountType) => {
      if (sendingMode === 'fast') {
        return 0; // No delay for fast mode
      }
      
      // Default delays for controlled mode
      const defaultDelays = {
        'smtp': 2000,        // 2 seconds
        'apps-script': 1000,  // 1 second
        'powermta': 500      // 0.5 seconds
      };
      
      return defaultDelays[accountType] || 2000;
    };

    // Calculate batch size based on sending mode
    const getBatchSize = (sendingMode, accountType) => {
      if (sendingMode === 'fast') {
        return accountType === 'smtp' ? 10 : 20; // Larger batches for fast mode
      }
      
      // Conservative batch sizes for controlled mode
      return accountType === 'smtp' ? 2 : 5;
    };

    // Process all accounts with mode-specific settings
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      console.log(`Processing account ${accountId}:`, accountData);
      
      const accountType = accountData.type || 'smtp';
      const accountConfig = accountData.config || {};
      const emails = accountData.emails || [];
      const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
      
      const emailDelay = getEmailDelay(sendingMode, accountType);
      const batchSize = getBatchSize(sendingMode, accountType);
      
      console.log(`⚡ ${sendingMode.toUpperCase()} MODE processing ${accountType} account: ${accountInfo.email} (${emails.length} emails, ${emailDelay}ms delay, batch size: ${batchSize})`);
      
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

          // Create SMTP transporter configuration
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
            maxConnections: sendingMode === 'fast' ? 5 : 1, // More connections for fast mode
            maxMessages: sendingMode === 'fast' ? 200 : 100
          };

          if (!isSecurePort) {
            transporterConfig.requireTLS = true;
          }

          console.log(`📧 Creating ${sendingMode} mode SMTP transporter for ${accountInfo.email}`);

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

          // Send emails in batches with mode-specific settings
          const batches = [];
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ ${sendingMode.toUpperCase()} SMTP ${accountInfo.email}: ${batches.length} batches of ${batchSize} emails each`);

          // Process batches with appropriate concurrency for sending mode
          if (sendingMode === 'fast') {
            // Fast mode: Process batches in parallel
            const batchPromises = batches.map(async (batch, batchIndex) => {
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

                    console.log(`📤 FAST SENDING SMTP email to ${emailData.recipient} via ${accountInfo.email} (From: ${fromName}, Subject: ${subject})`);
                    
                    const info = await transporter.sendMail(mailOptions);
                    totalSent++;
                    console.log(`✅ FAST SMTP SENT: ${emailData.recipient} via ${accountInfo.email} (MessageID: ${info.messageId})`);
                    
                    return { success: true, recipient: emailData.recipient, messageId: info.messageId, rotation: { fromName, subject } };
                  } catch (error) {
                    totalFailed++;
                    console.error(`❌ FAST SMTP FAILED: ${emailData.recipient} - ${error.message}`);
                    return { success: false, recipient: emailData.recipient, error: error.message };
                  }
                })
              );

              return batchResults.map(result => 
                result.status === 'fulfilled' ? result.value : { success: false, error: result.reason?.message || 'Unknown error' }
              );
            });

            const allBatchResults = await Promise.all(batchPromises);
            allBatchResults.forEach(batchResults => results.push(...batchResults));

          } else {
            // Controlled mode: Process batches sequentially
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

                    console.log(`📤 CONTROLLED SENDING SMTP email to ${emailData.recipient} via ${accountInfo.email} (From: ${fromName}, Subject: ${subject})`);
                    
                    const info = await transporter.sendMail(mailOptions);
                    totalSent++;
                    console.log(`✅ CONTROLLED SMTP SENT: ${emailData.recipient} via ${accountInfo.email} (MessageID: ${info.messageId})`);
                    
                    return { success: true, recipient: emailData.recipient, messageId: info.messageId, rotation: { fromName, subject } };
                  } catch (error) {
                    totalFailed++;
                    console.error(`❌ CONTROLLED SMTP FAILED: ${emailData.recipient} - ${error.message}`);
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
                
              console.log(`⚡ CONTROLLED SMTP Batch ${batchIndex + 1}/${batches.length}: ${totalSent} sent, ${totalFailed} failed`);
              
              // Add delay between batches only in controlled mode
              if (batchIndex < batches.length - 1 && emailDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, emailDelay));
              }
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
          // Enhanced Apps Script handling with dual mode support
          const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          const batches = [];
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ ${sendingMode.toUpperCase()} Apps Script ${accountInfo.email}: ${batches.length} batches`);

          if (sendingMode === 'fast') {
            // Fast mode: Process all batches in parallel
            const batchPromises = batches.map(async (batch, batchIndex) => {
              return Promise.all(batch.map(async (emailData, localIndex) => {
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
                  const timeoutId = setTimeout(() => controller.abort(), 10000);

                  const response = await fetch(scriptUrl, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'User-Agent': 'GoogleCloudFunction-FastMode/1.0'
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
                      console.log(`✅ FAST SENT: ${emailData.recipient} via Apps Script (From: ${fromName}, Subject: ${subject})`);
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
                  console.error(`❌ FAST FAILED: ${emailData.recipient} - ${error.message}`);
                  return { success: false, recipient: emailData.recipient, error: error.message };
                }
              }));
            });

            const allBatchResults = await Promise.all(batchPromises);
            allBatchResults.forEach(batchResults => results.push(...batchResults));

          } else {
            // Controlled mode: Process batches sequentially with delays
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
                      'User-Agent': 'GoogleCloudFunction-ControlledMode/1.0'
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
                      console.log(`✅ CONTROLLED SENT: ${emailData.recipient} via Apps Script (From: ${fromName}, Subject: ${subject})`);
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
                  console.error(`❌ CONTROLLED FAILED: ${emailData.recipient} - ${error.message}`);
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

              console.log(`⚡ CONTROLLED Apps Script batch ${batchIndex + 1}/${batches.length} completed`);
              
              // Add delay between batches only in controlled mode
              if (batchIndex < batches.length - 1 && emailDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, emailDelay));
              }
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
    console.log(`⚡ Waiting for ${accountPromises.length} accounts to complete ${sendingMode} mode processing...`);
    await Promise.all(accountPromises);

    // Final campaign completion
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

    console.log(`🎉 ${sendingMode.toUpperCase()} MODE CAMPAIGN COMPLETED: ${totalSent} sent, ${totalFailed} failed`);

    res.set(corsHeaders);
    res.json({ 
      success: true,
      completed: true,
      status: 'completed',
      sentCount: totalSent,
      failedCount: totalFailed,
      totalEmails: totalSent + totalFailed,
      successRate: totalSent > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0,
      campaignId,
      sendingMode,
      message: `${sendingMode.toUpperCase()} MODE campaign completed successfully with rotation features`,
      performance: {
        sendingMode: sendingMode,
        fastMode: sendingMode === 'fast',
        controlledMode: sendingMode === 'controlled',
        parallel_processing: sendingMode === 'fast',
        sequential_processing: sendingMode === 'controlled',
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation
      },
      features: {
        rotation: rotation,
        sendingMode: sendingMode
      },
      sampleResults: results.slice(0, 5)
    });

  } catch (error) {
    console.error('💥 DUAL MODE CRITICAL ERROR:', error);
    console.error('Error stack:', error.stack);
    
    try {
      if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Dual mode sender error: ${error.message}`,
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
      dualModeEnabled: true,
      stack: error.stack
    });
  }
});
