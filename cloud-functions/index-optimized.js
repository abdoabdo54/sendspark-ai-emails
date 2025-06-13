
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// OPTIMIZED: Pre-create transporter pool
const transporterPool = new Map();

// Configure nodemailer transporter based on account type
function createTransporter(accountConfig) {
  if (accountConfig.type === 'smtp') {
    const key = `${accountConfig.host}:${accountConfig.user}`;
    if (!transporterPool.has(key)) {
      const transporter = nodemailer.createTransporter({
        host: accountConfig.host,
        port: accountConfig.port,
        secure: accountConfig.secure || false,
        auth: {
          user: accountConfig.user,
          pass: accountConfig.pass
        },
        pool: true,
        maxConnections: 50, // INCREASED for faster sending
        maxMessages: 1000,  // INCREASED for faster sending
        rateLimit: false,   // DISABLED for zero delay
        socketTimeout: 5000,
        connectionTimeout: 5000
      });
      transporterPool.set(key, transporter);
    }
    return transporterPool.get(key);
  }
  
  return null;
}

// OPTIMIZED: Send email via Apps Script with retry
async function sendViaAppsScript(accountConfig, emailData) {
  const maxRetries = 2;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        }),
        timeout: 10000 // 10 second timeout
      });

      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        return { success: true, messageId: result.messageId };
      } else {
        throw new Error(result.message || 'Apps Script error');
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief retry delay
      }
    }
  }
  
  return { success: false, error: lastError.message };
}

// OPTIMIZED: Send email via SMTP with retry
async function sendViaSMTP(transporter, emailData) {
  const maxRetries = 2;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief retry delay
      }
    }
  }
  
  return { success: false, error: lastError.message };
}

// OPTIMIZED: Main function handler
const sendEmailCampaignZeroDelay = async (req, res) => {
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

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🚀 [${campaignId}] OPTIMIZED: Processing slice: ${slice.recipients.length} emails`);

    const results = [];
    const config = campaignData.config || {};
    const sendingMode = config.sendingMode || 'zero-delay';
    const dispatchMethod = config.dispatchMethod || 'parallel';

    console.log(`📊 [${campaignId}] OPTIMIZED Mode: ${sendingMode}, Dispatch: ${dispatchMethod}`);

    // OPTIMIZED: Use prepared emails if available for perfect rotation
    const recipients = slice.recipients;
    const preparedEmails = slice.preparedEmails || [];
    const useRotation = preparedEmails.length > 0;

    if (useRotation) {
      console.log(`🔄 [${campaignId}] Using PERFECT ROTATION from prepared emails`);
    }

    // OPTIMIZED: Process based on sending mode
    if (sendingMode === 'zero-delay') {
      console.log(`🚀 [${campaignId}] ZERO DELAY MODE: Maximum speed processing`);
      
      // ZERO DELAY: Process in parallel batches for maximum speed
      const batchSize = Math.min(50, recipients.length); // Process in batches of 50
      const batches = [];
      
      for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (recipient, batchIndex) => {
          const globalIndex = recipients.indexOf(recipient);
          const account = accounts[globalIndex % accounts.length];
          
          try {
            // Use prepared email data if available (perfect rotation)
            const preparedEmail = useRotation ? preparedEmails[globalIndex] : null;
            
            const emailData = {
              to: recipient,
              subject: preparedEmail?.subject || campaignData.subject,
              html: preparedEmail?.html_content || campaignData.html_content,
              text: preparedEmail?.text_content || campaignData.text_content,
              fromName: preparedEmail?.from_name || campaignData.from_name,
              fromEmail: account.email
            };

            let result;

            // Send based on account type
            if (account.type === 'smtp') {
              const transporter = createTransporter(account.config);
              if (transporter) {
                result = await sendViaSMTP(transporter, emailData);
              } else {
                result = { success: false, error: 'Failed to create SMTP transporter' };
              }
            } else if (account.type === 'apps-script') {
              result = await sendViaAppsScript(account.config, emailData);
            } else {
              result = { success: false, error: `Unsupported account type: ${account.type}` };
            }

            if (result.success) {
              console.log(`✅ [${campaignId}] ${globalIndex+1}/${recipients.length} → ${recipient} via ${account.name}`);
              return {
                recipient,
                status: 'sent',
                accountType: account.type,
                accountName: account.name,
                messageId: result.messageId,
                timestamp: new Date().toISOString()
              };
            } else {
              console.log(`❌ [${campaignId}] ${globalIndex+1}/${recipients.length} → ${recipient}: ${result.error}`);
              return {
                recipient,
                status: 'failed',
                error: result.error,
                accountType: account.type,
                accountName: account.name,
                timestamp: new Date().toISOString()
              };
            }
          } catch (error) {
            console.error(`❌ [${campaignId}] Error processing ${recipient}:`, error);
            return {
              recipient,
              status: 'failed',
              error: error.message,
              timestamp: new Date().toISOString()
            };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        console.log(`📊 [${campaignId}] Batch completed: ${batchResults.filter(r => r.status === 'sent').length}/${batchResults.length} sent`);
      }
    } else {
      // NON-ZERO DELAY: Sequential processing with delays
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const account = accounts[i % accounts.length];
        
        try {
          // Use prepared email data if available (perfect rotation)
          const preparedEmail = useRotation ? preparedEmails[i] : null;
          
          const emailData = {
            to: recipient,
            subject: preparedEmail?.subject || campaignData.subject,
            html: preparedEmail?.html_content || campaignData.html_content,
            text: preparedEmail?.text_content || campaignData.text_content,
            fromName: preparedEmail?.from_name || campaignData.from_name,
            fromEmail: account.email
          };

          let result;

          // Send based on account type
          if (account.type === 'smtp') {
            const transporter = createTransporter(account.config);
            if (transporter) {
              result = await sendViaSMTP(transporter, emailData);
            } else {
              result = { success: false, error: 'Failed to create SMTP transporter' };
            }
          } else if (account.type === 'apps-script') {
            result = await sendViaAppsScript(account.config, emailData);
          } else {
            result = { success: false, error: `Unsupported account type: ${account.type}` };
          }

          if (result.success) {
            console.log(`✅ [${campaignId}] ${i+1}/${recipients.length} → ${recipient} via ${account.name}`);
            results.push({
              recipient,
              status: 'sent',
              accountType: account.type,
              accountName: account.name,
              messageId: result.messageId,
              timestamp: new Date().toISOString()
            });
          } else {
            console.log(`❌ [${campaignId}] ${i+1}/${recipients.length} → ${recipient}: ${result.error}`);
            results.push({
              recipient,
              status: 'failed',
              error: result.error,
              accountType: account.type,
              accountName: account.name,
              timestamp: new Date().toISOString()
            });
          }

          // Apply delay based on sending mode (NOT in zero-delay mode)
          if (sendingMode === 'controlled') {
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (sendingMode === 'fast') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

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
    }

    // OPTIMIZED: Batch update campaign statistics
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;

    // Update stats without waiting
    supabase
      .from('email_campaigns')
      .select('sent_count')
      .eq('id', campaignId)
      .single()
      .then(({ data: currentCampaign }) => {
        const newSentCount = (currentCampaign?.sent_count || 0) + sentCount;
        return supabase
          .from('email_campaigns')
          .update({ sent_count: newSentCount })
          .eq('id', campaignId);
      })
      .catch(error => console.error(`❌ [${campaignId}] Stats update failed:`, error));

    const successRate = Math.round((sentCount / recipients.length) * 100);
    console.log(`✅ [${campaignId}] OPTIMIZED slice completed: ${sentCount} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: recipients.length,
      sent: sentCount,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      sendingMode,
      dispatchMethod,
      optimized: true,
      rotationUsed: useRotation,
      results: results.slice(-5)
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ OPTIMIZED Function error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Clean up transporters on exit
process.on('exit', () => {
  transporterPool.forEach(transporter => transporter.close());
});

// Register the function with Functions Framework
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
