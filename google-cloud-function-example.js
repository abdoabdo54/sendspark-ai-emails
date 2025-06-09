
/**
 * Google Cloud Function for sending email campaigns with rate limiting
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
      rateLimit, 
      batchSize,
      supabaseUrl,
      supabaseKey 
    } = req.body;

    console.log(`Starting campaign ${campaignId} with ${preparedEmails.length} emails`);
    console.log(`Rate limit: ${rateLimit} emails/hour, Batch size: ${batchSize}`);

    // Calculate delay between emails (in milliseconds)
    const delayMs = (60 * 60 * 1000) / rateLimit;
    
    // Group emails by account type for better distribution
    const emailsByAccount = {};
    preparedEmails.forEach(email => {
      const accountId = email.accountId;
      if (!emailsByAccount[accountId]) {
        emailsByAccount[accountId] = [];
      }
      emailsByAccount[accountId].push(email);
    });

    console.log(`Emails grouped across ${Object.keys(emailsByAccount).length} accounts`);

    // Process emails in parallel across accounts but with rate limiting
    const accountIds = Object.keys(emailsByAccount);
    const results = [];
    let totalSent = 0;
    let totalFailed = 0;

    // Process each account concurrently
    const accountPromises = accountIds.map(async (accountId, accountIndex) => {
      const emails = emailsByAccount[accountId];
      console.log(`Account ${accountId}: ${emails.length} emails`);
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        // Process batch
        const batchPromises = batch.map(async (emailData, emailIndex) => {
          try {
            // Add staggered delay based on account and email index
            const staggerDelay = (accountIndex * 1000) + (emailIndex * (delayMs / batchSize));
            await new Promise(resolve => setTimeout(resolve, staggerDelay));
            
            // Send email based on account type
            let result;
            if (emailData.accountType === 'smtp') {
              result = await sendEmailViaSMTP(emailData);
            } else if (emailData.accountType === 'apps-script') {
              result = await sendEmailViaAppsScript(emailData);
            } else {
              throw new Error(`Unsupported account type: ${emailData.accountType}`);
            }
            
            if (result.success) {
              totalSent++;
              console.log(`✓ Email sent to: ${emailData.recipient}`);
            } else {
              totalFailed++;
              console.log(`✗ Email failed to: ${emailData.recipient} - ${result.error}`);
            }
            
            return { email: emailData.recipient, success: result.success, error: result.error };
          } catch (error) {
            totalFailed++;
            console.log(`✗ Error for ${emailData.recipient}:`, error.message);
            return { email: emailData.recipient, success: false, error: error.message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Update progress in Supabase
        await updateCampaignProgress(campaignId, totalSent, supabaseUrl, supabaseKey);
        
        console.log(`Batch ${Math.floor(i/batchSize) + 1} completed for account ${accountId}`);
      }
    });

    // Wait for all accounts to finish
    await Promise.all(accountPromises);

    // Final update to Supabase
    await updateCampaignFinal(campaignId, totalSent, totalFailed, supabaseUrl, supabaseKey);

    console.log(`Campaign ${campaignId} completed: ${totalSent} sent, ${totalFailed} failed`);

    res.status(200).json({
      success: true,
      campaignId,
      totalSent,
      totalFailed,
      totalEmails: preparedEmails.length,
      results: results.slice(0, 10) // Return first 10 results as sample
    });

  } catch (error) {
    console.error('Error in sendEmailCampaign:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to send email via SMTP
async function sendEmailViaSMTP(emailData) {
  try {
    // Call your Supabase SMTP function
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        config: emailData.accountConfig,
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
    return { success: response.ok && result.success, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper function to send email via Apps Script
async function sendEmailViaAppsScript(emailData) {
  try {
    const response = await fetch(emailData.accountConfig.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: emailData.recipient,
        subject: emailData.subject,
        htmlBody: emailData.htmlContent,
        plainBody: emailData.textContent || '',
        fromName: emailData.fromName,
        fromAlias: emailData.fromEmail
      })
    });

    if (response.ok) {
      const result = await response.json();
      return { success: result.status === 'success', error: result.message };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper function to update campaign progress
async function updateCampaignProgress(campaignId, sentCount, supabaseUrl, supabaseKey) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        sent_count: sentCount
      })
    });
    
    if (!response.ok) {
      console.error('Failed to update campaign progress:', response.status);
    }
  } catch (error) {
    console.error('Error updating campaign progress:', error.message);
  }
}

// Helper function to update campaign final status
async function updateCampaignFinal(campaignId, sentCount, failedCount, supabaseUrl, supabaseKey) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        sent_count: sentCount,
        status: 'sent',
        sent_at: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      console.error('Failed to update campaign final status:', response.status);
    }
  } catch (error) {
    console.error('Error updating campaign final status:', error.message);
  }
}
