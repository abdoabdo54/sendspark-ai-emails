
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure nodemailer transporter
function createTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    console.log(`🔧 Creating SMTP transporter for ${account.name}:`, {
      host: config.host,
      port: config.port,
      user: config.username || config.user,
      hasPassword: !!(config.password || config.pass),
      secure: config.secure
    });

    return nodemailer.createTransporter({
      host: config.host,
      port: config.port || 587,
      secure: config.secure || false,
      auth: {
        user: config.username || config.user,
        pass: config.password || config.pass
      },
      pool: true,
      maxConnections: 50,
      maxMessages: 100,
      rateLimit: false
    });
  }
  
  return null;
}

// Send email via Apps Script
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    const scriptUrl = config.script_url;
    
    if (!scriptUrl) {
      console.error(`❌ Apps Script URL not configured for ${account.name}`);
      return { success: false, error: 'Apps Script URL not configured' };
    }

    console.log(`📧 Sending via Apps Script: ${account.name} to ${emailData.to}`);

    const response = await fetch(scriptUrl, {
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
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Apps Script HTTP error:`, response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log(`📧 Apps Script response:`, result);
    
    if (result.status === 'success' || result.success) {
      return { success: true, messageId: result.messageId || 'apps-script-sent' };
    } else {
      return { success: false, error: result.message || result.error || 'Apps Script error' };
    }
  } catch (error) {
    console.error(`❌ Apps Script error for ${account.name}:`, error);
    return { success: false, error: error.message };
  }
}

// Send email via SMTP
async function sendViaSMTP(transporter, emailData) {
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
    console.error(`❌ SMTP error:`, error);
    return { success: false, error: error.message };
  }
}

// Process single email
async function processEmail(recipient, account, campaignData, globalIndex, totalAccounts) {
  try {
    const emailData = {
      to: recipient,
      subject: campaignData.subject,
      html: campaignData.html_content,
      text: campaignData.text_content,
      fromName: campaignData.from_name,
      fromEmail: account.email
    };

    console.log(`📧 Processing: ${recipient} via ${account.name} (${account.type})`);

    let result;

    if (account.type === 'smtp') {
      const transporter = createTransporter(account);
      if (transporter) {
        result = await sendViaSMTP(transporter, emailData);
        transporter.close();
      } else {
        result = { success: false, error: 'Failed to create SMTP transporter' };
      }
    } else if (account.type === 'apps-script') {
      result = await sendViaAppsScript(account, emailData);
    } else {
      result = { success: false, error: `Unsupported account type: ${account.type}` };
    }

    const accountIndex = globalIndex % totalAccounts;
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${recipient} via ${account.name}`);
      return {
        recipient,
        status: 'sent',
        accountType: account.type,
        accountName: account.name,
        accountIndex: accountIndex + 1,
        accountId: account.id,
        globalIndex: globalIndex + 1,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`❌ FAILED: ${recipient} via ${account.name} - ${result.error}`);
      return {
        recipient,
        status: 'failed',
        error: result.error,
        accountType: account.type,
        accountName: account.name,
        accountIndex: accountIndex + 1,
        accountId: account.id,
        globalIndex: globalIndex + 1,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`❌ Error processing ${recipient}:`, error);
    return {
      recipient,
      status: 'failed',
      error: error.message,
      globalIndex: globalIndex + 1,
      timestamp: new Date().toISOString()
    };
  }
}

// Main function handler
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
      organizationId,
      globalStartIndex = 0
    } = req.body;

    console.log(`🚀 GCF: Received request:`, {
      campaignId,
      recipients: slice?.recipients?.length || 0,
      accounts: accounts?.length || 0,
      globalStartIndex,
      hasPreparedEmails: !!slice?.preparedEmails
    });

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy and ready to process campaigns",
        timestamp: new Date().toISOString()
      });
    }

    // Validate input
    if (!slice?.recipients || !Array.isArray(slice.recipients) || slice.recipients.length === 0) {
      console.error(`❌ GCF: No recipients provided`);
      return res.status(400).json({
        success: false,
        error: 'No recipients provided',
        received: { 
          slice: !!slice, 
          recipients: slice?.recipients?.length || 0,
          accounts: accounts?.length || 0 
        }
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      console.error(`❌ GCF: No accounts provided`);
      return res.status(400).json({
        success: false,
        error: 'No accounts provided'
      });
    }

    console.log(`🚀 GCF: Processing ${slice.recipients.length} emails with ${accounts.length} accounts`);
    
    // Log account details
    accounts.forEach((account, index) => {
      console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      if (account.type === 'apps-script') {
        console.log(`     Script URL: ${account.config?.script_url ? 'SET' : 'MISSING'}`);
      } else if (account.type === 'smtp') {
        console.log(`     SMTP Host: ${account.config?.host || 'MISSING'}`);
      }
    });

    const batchSize = 10; // Process in smaller batches for better error handling

    // Process emails
    const emailTasks = slice.recipients.map((recipient, localIndex) => {
      const globalIndex = globalStartIndex + localIndex;
      const accountIndex = globalIndex % accounts.length;
      const account = accounts[accountIndex];
      
      return () => processEmail(recipient, account, campaignData, globalIndex, accounts.length);
    });

    const results = [];
    let totalSent = 0;
    
    for (let i = 0; i < emailTasks.length; i += batchSize) {
      const batch = emailTasks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(emailTasks.length / batchSize);
      
      console.log(`🚀 GCF: Processing batch ${batchNumber}/${totalBatches}: ${batch.length} emails`);
      
      const batchResults = await Promise.all(batch.map(task => task()));
      results.push(...batchResults);
      
      const batchSent = batchResults.filter(r => r.status === 'sent').length;
      totalSent += batchSent;
      
      console.log(`✅ GCF: Batch ${batchNumber} complete: ${batchSent}/${batch.length} sent`);
      
      // Update campaign progress
      if (batchSent > 0) {
        try {
          const { data: currentCampaign } = await supabase
            .from('email_campaigns')
            .select('sent_count')
            .eq('id', campaignId)
            .single();

          const newSentCount = (currentCampaign?.sent_count || 0) + batchSent;
          
          await supabase
            .from('email_campaigns')
            .update({ sent_count: newSentCount })
            .eq('id', campaignId);
            
          console.log(`📝 GCF: Updated campaign sent_count to ${newSentCount}`);
        } catch (error) {
          console.error(`❌ GCF: Progress update failed:`, error);
        }
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / slice.recipients.length) * 100);

    console.log(`✅ GCF: Complete - ${totalSent} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);

    // Log failed emails for debugging
    const failedEmails = results.filter(r => r.status === 'failed');
    if (failedEmails.length > 0) {
      console.log(`❌ GCF: Failed emails:`, failedEmails.slice(0, 5).map(f => `${f.recipient}: ${f.error}`));
    }

    res.status(200).json({
      success: true,
      campaignId,
      processed: slice.recipients.length,
      sent: totalSent,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      batchesProcessed: Math.ceil(slice.recipients.length / batchSize),
      globalStartIndex,
      accountDistribution: accounts.map((account, index) => ({
        accountName: account.name,
        accountId: account.id,
        accountIndex: index + 1,
        emailsSent: results.filter(r => r.accountIndex === index + 1 && r.status === 'sent').length
      })),
      sampleResults: results.slice(-3) // Last 3 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ GCF: Function error:', error);
    
    // Update campaign status to failed
    if (req.body.campaignId) {
      try {
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', req.body.campaignId);
      } catch (dbError) {
        console.error('❌ GCF: Failed to update campaign status:', dbError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
