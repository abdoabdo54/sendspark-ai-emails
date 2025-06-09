
/**
 * Google Cloud Function for sending email campaigns with rate limiting
 * Optimized for high-volume sending with SMTP and Apps Script support
 * Deploy this to Google Cloud Functions to handle large volume email sending
 */

const functions = require('@google-cloud/functions-framework');

// Register a HTTP function
functions.http('sendEmailCampaign', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { 
      campaignId, 
      preparedEmails, 
      rateLimit = 3600, // Default: 1 email per second
      batchSize = 10,
      supabaseUrl,
      supabaseKey 
    } = req.body;

    console.log(`🚀 Starting campaign ${campaignId} with ${preparedEmails.length} emails`);
    console.log(`⚙️ Configuration: ${rateLimit} emails/hour, ${batchSize} batch size`);

    // Calculate optimal delay between emails (in milliseconds)
    const delayMs = Math.max((60 * 60 * 1000) / rateLimit, 100); // Minimum 100ms
    
    // Group emails by account for better distribution and performance
    const emailsByAccount = {};
    preparedEmails.forEach(email => {
      const accountKey = `${email.accountType}-${email.accountId}`;
      if (!emailsByAccount[accountKey]) {
        emailsByAccount[accountKey] = {
          type: email.accountType,
          config: email.accountConfig,
          emails: []
        };
      }
      emailsByAccount[accountKey].emails.push(email);
    });

    const accountKeys = Object.keys(emailsByAccount);
    console.log(`📊 Emails distributed across ${accountKeys.length} accounts`);

    let totalSent = 0;
    let totalFailed = 0;
    const results = [];

    // Process accounts in parallel with controlled concurrency
    const processAccount = async (accountKey, accountData, accountIndex) => {
      const { type, config, emails } = accountData;
      console.log(`📧 Processing account ${accountKey}: ${emails.length} emails (${type})`);
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        // Process batch with staggered timing
        const batchPromises = batch.map(async (emailData, emailIndex) => {
          try {
            // Stagger emails across accounts and within batches
            const accountDelay = accountIndex * 200; // 200ms between account starts
            const emailDelay = emailIndex * (delayMs / batchSize);
            const totalDelay = accountDelay + emailDelay;
            
            await new Promise(resolve => setTimeout(resolve, totalDelay));
            
            // Send email based on account type
            let result;
            if (type === 'smtp') {
              result = await sendEmailViaSMTP(emailData, config);
            } else if (type === 'apps-script') {
              result = await sendEmailViaAppsScript(emailData, config);
            } else {
              throw new Error(`Unsupported account type: ${type}`);
            }
            
            if (result.success) {
              totalSent++;
              console.log(`✅ [${type}] Email sent to: ${emailData.recipient}`);
            } else {
              totalFailed++;
              console.log(`❌ [${type}] Email failed to: ${emailData.recipient} - ${result.error}`);
            }
            
            return { 
              email: emailData.recipient, 
              success: result.success, 
              error: result.error,
              accountType: type,
              accountKey
            };
          } catch (error) {
            totalFailed++;
            console.log(`💥 [${type}] Error for ${emailData.recipient}:`, error.message);
            return { 
              email: emailData.recipient, 
              success: false, 
              error: error.message,
              accountType: type,
              accountKey
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Update progress every batch
        if (i % (batchSize * 5) === 0) { // Update every 5 batches
          await updateCampaignProgress(campaignId, totalSent, supabaseUrl, supabaseKey);
        }
        
        console.log(`📈 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(emails.length/batchSize)} completed for ${accountKey}`);
      }
    };

    // Process all accounts concurrently
    const accountPromises = accountKeys.map((accountKey, index) => 
      processAccount(accountKey, emailsByAccount[accountKey], index)
    );

    await Promise.all(accountPromises);

    // Final progress update
    await updateCampaignFinal(campaignId, totalSent, totalFailed, supabaseUrl, supabaseKey);

    console.log(`🎉 Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed`);

    // Calculate performance metrics
    const successRate = totalSent / (totalSent + totalFailed) * 100;
    const actualRate = totalSent / (Date.now() / 1000 / 3600); // emails per hour

    res.status(200).json({
      success: true,
      campaignId,
      totalSent,
      totalFailed,
      totalEmails: preparedEmails.length,
      successRate: Math.round(successRate * 100) / 100,
      actualEmailsPerHour: Math.round(actualRate),
      targetEmailsPerHour: rateLimit,
      accountsUsed: accountKeys.length,
      executionTime: Date.now() - req.startTime,
      sampleResults: results.slice(0, 5) // First 5 results for debugging
    });

  } catch (error) {
    console.error('💥 Error in sendEmailCampaign:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      campaignId: req.body?.campaignId || 'unknown'
    });
  }
});

// Optimized SMTP sending function
async function sendEmailViaSMTP(emailData, smtpConfig) {
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        config: smtpConfig,
        emailData: {
          from: { email: emailData.fromEmail, name: emailData.fromName },
          to: emailData.recipient,
          subject: emailData.subject,
          html: emailData.htmlContent,
          text: emailData.textContent
        }
      })
    });

    const result = await response.json();
    return { 
      success: response.ok && result.success, 
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Optimized Apps Script sending function with quota management
async function sendEmailViaAppsScript(emailData, appsScriptConfig) {
  try {
    const payload = {
      to: emailData.recipient,
      subject: emailData.subject,
      htmlBody: emailData.htmlContent,
      plainBody: emailData.textContent || '',
      fromName: emailData.fromName,
      fromAlias: emailData.fromEmail
    };

    const response = await fetch(appsScriptConfig.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      return { 
        success: result.status === 'success', 
        error: result.message,
        quotaRemaining: result.remainingQuota
      };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Efficient progress update function
async function updateCampaignProgress(campaignId, sentCount, supabaseUrl, supabaseKey) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sent_count: sentCount,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('❌ Error updating progress:', error.message);
  }
}

// Final status update function
async function updateCampaignFinal(campaignId, sentCount, failedCount, supabaseUrl, supabaseKey) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sent_count: sentCount,
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('❌ Error updating final status:', error.message);
  }
}
