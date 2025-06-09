
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

functions.http('sendEmailCampaign', async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {}
    } = req.body;
    
    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    console.log(`🚀 STARTING HIGH-SPEED CAMPAIGN ${campaignId}`);
    console.log(`📊 Processing ${Object.keys(emailsByAccount || {}).length} accounts`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    let totalSent = 0;
    let totalFailed = 0;
    const results = [];

    // Process all accounts in parallel for maximum speed
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      const { type, config: accountConfig, emails, accountInfo } = accountData;
      
      console.log(`📧 Processing ${type} account: ${accountInfo.email} (${emails.length} emails)`);
      
      try {
        if (type === 'smtp') {
          // Create optimized SMTP transporter
          const transporter = nodemailer.createTransporter({
            host: accountConfig.host,
            port: accountConfig.port,
            secure: accountConfig.encryption === 'ssl',
            auth: {
              user: accountConfig.username,
              pass: accountConfig.password
            },
            pool: true,
            maxConnections: 10, // Increased for speed
            maxMessages: 1000,  // Increased for speed
            rateLimit: accountConfig.emails_per_hour ? Math.floor(accountConfig.emails_per_hour / 3600) : 10 // Convert to per second
          });

          // Send emails in optimized batches
          const batchSize = 20; // Increased batch size
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          // Process batches in parallel
          const batchPromises = batches.map(async (batch, batchIndex) => {
            const batchResults = await Promise.all(
              batch.map(async (emailData) => {
                try {
                  const info = await transporter.sendMail({
                    from: `${emailData.fromName} <${emailData.fromEmail}>`,
                    to: emailData.recipient,
                    subject: emailData.subject,
                    html: emailData.htmlContent,
                    text: emailData.textContent
                  });

                  totalSent++;
                  console.log(`✅ SENT: ${emailData.recipient} via SMTP`);
                  
                  return { success: true, recipient: emailData.recipient, messageId: info.messageId };
                } catch (error) {
                  totalFailed++;
                  console.error(`❌ FAILED: ${emailData.recipient} - ${error.message}`);
                  return { success: false, recipient: emailData.recipient, error: error.message };
                }
              })
            );

            // Update progress after each batch
            await supabase
              .from('email_campaigns')
              .update({ sent_count: totalSent })
              .eq('id', campaignId);
              
            console.log(`📈 Batch ${batchIndex + 1}/${batches.length} completed: ${totalSent} sent, ${totalFailed} failed`);
            
            return batchResults;
          });

          const allBatchResults = await Promise.all(batchPromises);
          results.push(...allBatchResults.flat());

          await transporter.close();

        } else if (type === 'apps-script') {
          // High-speed Apps Script processing
          const batchSize = 10; // Optimized for Apps Script
          const batches = [];
          
          for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
          }

          // Process batches sequentially for Apps Script (to avoid quota issues)
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const batchPromises = batch.map(async (emailData) => {
              try {
                const response = await fetch(accountConfig.exec_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: emailData.recipient,
                    subject: emailData.subject,
                    htmlBody: emailData.htmlContent,
                    plainBody: emailData.textContent,
                    fromName: emailData.fromName,
                    fromAlias: emailData.fromEmail
                  })
                });

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
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (error) {
                totalFailed++;
                console.error(`❌ FAILED: ${emailData.recipient} - ${error.message}`);
                return { success: false, recipient: emailData.recipient, error: error.message };
              }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Update progress
            await supabase
              .from('email_campaigns')
              .update({ sent_count: totalSent })
              .eq('id', campaignId);

            console.log(`📈 Apps Script batch ${batchIndex + 1}/${batches.length} completed`);
          }
        }

      } catch (accountError) {
        console.error(`💥 Account ${accountId} error:`, accountError);
        totalFailed += emails.length;
      }
    });

    // Wait for all accounts to finish processing
    await Promise.all(accountPromises);

    // Mark campaign as completed
    const finalStatus = totalSent > 0 ? 'sent' : 'failed';
    const updateData = { 
      status: finalStatus,
      sent_count: totalSent,
      completed_at: new Date().toISOString()
    };

    if (totalFailed > 0) {
      updateData.error_message = `${totalFailed} emails failed to send`;
    }

    await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', campaignId);

    console.log(`🎉 HIGH-SPEED CAMPAIGN COMPLETED: ${totalSent} sent, ${totalFailed} failed in optimized time`);

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
      message: 'High-speed campaign completed successfully',
      performance: {
        optimized: true,
        parallel_processing: true,
        batch_size: 'optimized'
      },
      sampleResults: results.slice(0, 5)
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error);
    
    // Revert campaign status on error
    try {
      const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', req.body.campaignId);
    } catch (revertError) {
      console.error('Failed to revert status:', revertError);
    }

    res.set(corsHeaders);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error',
      campaignId: req.body.campaignId,
      timestamp: new Date().toISOString()
    });
  }
});
