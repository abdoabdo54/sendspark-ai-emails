
/**
 * COMPLETE Google Cloud Function for sending email campaigns
 * This function actually sends emails using SMTP and Apps Script accounts
 */

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

    console.log(`🚀 STARTING IMMEDIATE CAMPAIGN ${campaignId}`);
    console.log(`📊 Accounts: ${Object.keys(emailsByAccount || {}).length}`);
    console.log(`⚡ IMMEDIATE MODE: ${config.immediateStart ? 'ENABLED' : 'DISABLED'}`);

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

    // Process all accounts in parallel for IMMEDIATE SENDING
    const accountPromises = Object.entries(emailsByAccount).map(async ([accountId, accountData]) => {
      const { type, config: accountConfig, emails, accountInfo } = accountData;
      
      console.log(`📧 Processing ${type} account: ${accountInfo.email} (${emails.length} emails)`);
      
      try {
        if (type === 'smtp') {
          // IMMEDIATE SMTP PROCESSING
          const transporter = nodemailer.createTransporter({
            host: accountConfig.host,
            port: accountConfig.port,
            secure: accountConfig.encryption === 'ssl',
            auth: {
              user: accountConfig.username,
              pass: accountConfig.password
            },
            // IMMEDIATE PROCESSING SETTINGS
            pool: true,
            maxConnections: 10,
            maxMessages: 100,
            rateDelta: 1000, // 1 second
            rateLimit: accountConfig.rateLimit || 10 // emails per second
          });

          // Send emails in IMMEDIATE batches
          const batchSize = accountConfig.batchSize || 50;
          for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (emailData, index) => {
              try {
                // IMMEDIATE SENDING - No delays
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
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Update progress IMMEDIATELY after each batch
            if (i % (batchSize * 2) === 0) { // Every 2 batches
              await supabase
                .from('email_campaigns')
                .update({ sent_count: totalSent })
                .eq('id', campaignId);
              
              console.log(`📈 Progress: ${totalSent} sent, ${totalFailed} failed`);
            }
          }

          await transporter.close();

        } else if (type === 'apps-script') {
          // IMMEDIATE APPS SCRIPT PROCESSING
          const batchSize = accountConfig.batchSize || 20;
          
          for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
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

            // IMMEDIATE progress updates
            await supabase
              .from('email_campaigns')
              .update({ sent_count: totalSent })
              .eq('id', campaignId);
          }
        }

      } catch (accountError) {
        console.error(`💥 Account ${accountId} error:`, accountError);
        totalFailed += emails.length;
      }
    });

    // Wait for ALL accounts to finish IMMEDIATELY
    await Promise.all(accountPromises);

    // IMMEDIATE COMPLETION - Mark campaign as completed
    const finalStatus = totalFailed > 0 ? 'sent' : 'sent'; // Even with some failures, mark as sent
    await supabase
      .from('email_campaigns')
      .update({ 
        status: finalStatus,
        sent_count: totalSent,
        completed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log(`🎉 CAMPAIGN COMPLETED IMMEDIATELY: ${totalSent} sent, ${totalFailed} failed`);

    res.set(corsHeaders);
    res.json({ 
      success: true,
      completed: true,
      status: 'completed',
      sentCount: totalSent,
      failedCount: totalFailed,
      totalEmails: totalSent + totalFailed,
      successRate: Math.round((totalSent / (totalSent + totalFailed)) * 100),
      campaignId,
      processingTime: Date.now() - req.startTime,
      message: 'CAMPAIGN COMPLETED IMMEDIATELY',
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
          error_message: error.message
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
