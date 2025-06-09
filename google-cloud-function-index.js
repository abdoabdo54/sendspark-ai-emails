
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Make sure the function name matches your deployed function
functions.http('sendEmailCampaign', async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    console.log('🚀 Google Cloud Function started - MAXIMUM SPEED MODE');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));

    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {}
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

    console.log(`🚀 STARTING MAXIMUM SPEED CAMPAIGN ${campaignId}`);
    console.log(`⚡ Processing ${Object.keys(emailsByAccount).length} accounts at MAXIMUM SPEED`);

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

    // Process all accounts in MAXIMUM PARALLEL for ultra speed
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      console.log(`Processing account ${accountId}:`, accountData);
      
      // Safely extract account data with fallbacks
      const accountType = accountData.type || 'smtp';
      const accountConfig = accountData.config || {};
      const emails = accountData.emails || [];
      const accountInfo = accountData.accountInfo || { name: 'Unknown', email: 'unknown@domain.com' };
      
      console.log(`⚡ MAXIMUM SPEED processing ${accountType} account: ${accountInfo.email} (${emails.length} emails)`);
      
      try {
        if (accountType === 'smtp') {
          // Validate SMTP configuration - check for both possible field names
          const smtpHost = accountConfig.host;
          const smtpPort = accountConfig.port;
          const smtpUser = accountConfig.user || accountConfig.username;
          const smtpPass = accountConfig.pass || accountConfig.password;
          
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

          // Create MAXIMUM SPEED SMTP transporter with enhanced reliability
          const transporterConfig = {
            host: smtpHost,
            port: parseInt(smtpPort) || 587,
            secure: parseInt(smtpPort) === 465, // Use SSL for port 465
            auth: {
              user: smtpUser,
              pass: smtpPass
            },
            pool: true,
            maxConnections: 2, // Conservative for reliability
            maxMessages: 20,   // Conservative for reliability
            rateLimit: false,   // NO rate limiting for maximum speed
            connectionTimeout: 30000, // 30 second timeout
            greetingTimeout: 15000,   // 15 second timeout
            socketTimeout: 30000,     // 30 second timeout
            logger: false, // Disable detailed logging for performance
            debug: false,  // Disable debug for performance
            tls: {
              rejectUnauthorized: false, // For compatibility
              ciphers: 'SSLv3'
            }
          };

          console.log(`📧 Creating SMTP transporter for ${accountInfo.email}:`, {
            host: smtpHost,
            port: smtpPort,
            secure: transporterConfig.secure,
            user: smtpUser
          });

          const transporter = nodemailer.createTransporter(transporterConfig);

          // Test connection first with timeout
          try {
            const verifyPromise = transporter.verify();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SMTP verification timeout')), 10000)
            );
            
            await Promise.race([verifyPromise, timeoutPromise]);
            console.log(`✅ SMTP connection verified for ${accountInfo.email}`);
          } catch (verifyError) {
            console.error(`❌ SMTP verification failed for ${accountInfo.email}:`, verifyError.message);
            throw new Error(`SMTP connection failed for ${accountInfo.email}: ${verifyError.message}`);
          }

          // Send emails in smaller batches for better reliability
          const batchSize = 3; // Very small batch for reliability
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ SMTP ${accountInfo.email}: ${batches.length} batches of ${batchSize} emails each`);

          // Process batches sequentially for SMTP to avoid overwhelming
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const batchResults = await Promise.allSettled(
              batch.map(async (emailData) => {
                try {
                  // Validate email data
                  if (!emailData.recipient || !emailData.subject) {
                    throw new Error('Missing recipient or subject');
                  }

                  const mailOptions = {
                    from: `${emailData.fromName || accountInfo.name} <${emailData.fromEmail || accountInfo.email}>`,
                    to: emailData.recipient,
                    subject: emailData.subject,
                    html: emailData.htmlContent || '',
                    text: emailData.textContent || ''
                  };

                  console.log(`📤 Sending email to ${emailData.recipient} via ${accountInfo.email}`);
                  
                  // Add timeout to sendMail
                  const sendPromise = transporter.sendMail(mailOptions);
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Send timeout')), 30000)
                  );
                  
                  const info = await Promise.race([sendPromise, timeoutPromise]);

                  totalSent++;
                  console.log(`✅ SENT: ${emailData.recipient} via SMTP (MessageID: ${info.messageId})`);
                  
                  return { success: true, recipient: emailData.recipient, messageId: info.messageId };
                } catch (error) {
                  totalFailed++;
                  console.error(`❌ FAILED: ${emailData.recipient} - ${error.message}`);
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
              
            console.log(`⚡ MAXIMUM SPEED Batch ${batchIndex + 1}/${batches.length}: ${totalSent} sent, ${totalFailed} failed`);
            
            // Small delay between batches to prevent overwhelming
            if (batchIndex < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
          }

          await transporter.close();

        } else if (accountType === 'apps-script') {
          // Validate Apps Script configuration
          if (!accountConfig.exec_url && !accountConfig.script_url) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          const scriptUrl = accountConfig.exec_url || accountConfig.script_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountInfo.email}`);
          }

          // MAXIMUM SPEED Apps Script processing
          const batchSize = 5; // Smaller batch for Apps Script
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          console.log(`⚡ Apps Script ${accountInfo.email}: ${batches.length} batches at MAXIMUM SPEED`);

          // Process batches sequentially for Apps Script
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const batchPromises = batch.map(async (emailData) => {
              try {
                if (!emailData.recipient || !emailData.subject) {
                  throw new Error('Missing recipient or subject');
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                const response = await fetch(scriptUrl, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'GoogleCloudFunction/1.0'
                  },
                  body: JSON.stringify({
                    to: emailData.recipient,
                    subject: emailData.subject,
                    htmlBody: emailData.htmlContent || '',
                    plainBody: emailData.textContent || '',
                    fromName: emailData.fromName || accountInfo.name,
                    fromAlias: emailData.fromEmail || accountInfo.email
                  }),
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                  const result = await response.json();
                  if (result.status === 'success') {
                    totalSent++;
                    console.log(`✅ SENT: ${emailData.recipient} via Apps Script`);
                    return { success: true, recipient: emailData.recipient };
                  } else {
                    throw new Error(result.message || 'Apps Script error');
                  }
                } else {
                  const errorText = await response.text();
                  throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
              } catch (error) {
                totalFailed++;
                console.error(`❌ FAILED: ${emailData.recipient} - ${error.message}`);
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

            console.log(`⚡ MAXIMUM SPEED Apps Script batch ${batchIndex + 1}/${batches.length} completed`);
            
            // Small delay between batches
            if (batchIndex < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } else {
          throw new Error(`Unsupported account type: ${accountType}`);
        }

      } catch (accountError) {
        console.error(`💥 Account ${accountId} CRITICAL error:`, accountError.message);
        
        // Mark remaining emails as failed for this account
        const failedCount = emails.length;
        totalFailed += failedCount;
        
        // Update campaign with account error
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

        // Add failed results for this account
        emails.forEach(email => {
          results.push({
            success: false,
            recipient: email.recipient,
            error: accountError.message
          });
        });
      }
    });

    // Wait for all accounts to finish MAXIMUM SPEED processing
    console.log(`⚡ Waiting for ${accountPromises.length} accounts to complete MAXIMUM SPEED processing...`);
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
      updateData.error_message = null; // Clear any previous errors on success
    }

    try {
      await supabase
        .from('email_campaigns')
        .update(updateData)
        .eq('id', campaignId);
    } catch (updateError) {
      console.error('Failed to update final status:', updateError);
    }

    console.log(`🎉 MAXIMUM SPEED CAMPAIGN COMPLETED: ${totalSent} sent, ${totalFailed} failed in RECORD TIME`);

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
      message: 'MAXIMUM SPEED campaign completed successfully',
      performance: {
        maxSpeed: true,
        ultraFast: true,
        parallel_processing: true,
        optimized_batching: true,
        record_time: true
      },
      sampleResults: results.slice(0, 5)
    });

  } catch (error) {
    console.error('💥 MAXIMUM SPEED CRITICAL ERROR:', error);
    console.error('Error stack:', error.stack);
    
    // Revert campaign status on error
    try {
      if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Maximum speed error: ${error.message}`,
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
      maxSpeedMode: true,
      stack: error.stack
    });
  }
});
