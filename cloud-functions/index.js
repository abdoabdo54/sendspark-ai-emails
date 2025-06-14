
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
      maxMessages: 100
    });
  }
  return null;
}

// Enhanced Apps Script sender with quota detection
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    const scriptUrl = config.script_url;
    
    if (!scriptUrl) {
      return { success: false, error: 'Apps Script URL not configured' };
    }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    
    // Enhanced quota detection
    if (result.status === 'error' || !result.success) {
      const errorMsg = result.message || result.error || 'Apps Script error';
      
      // Detect quota exceeded in multiple languages
      if (errorMsg.includes('Service invoked too many times') || 
          errorMsg.includes('تم تفعيل الخدمة مرات كثيرة') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('limit exceeded')) {
        console.log(`🚫 QUOTA EXCEEDED for account ${account.name}: ${errorMsg}`);
        return { success: false, error: `QUOTA_EXCEEDED: ${errorMsg}` };
      }
      
      return { success: false, error: errorMsg };
    }
    
    return { success: true, messageId: result.messageId || 'apps-script-sent' };
      
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
    return { success: false, error: error.message };
  }
}

// Process prepared email with enhanced error handling
async function processEmail(preparedEmail, account, campaignData, globalIndex, totalAccounts) {
  try {
    // Use the prepared email data (with rotation applied)
    const emailData = {
      to: preparedEmail.to,
      subject: preparedEmail.subject,  // Use rotated subject
      html: campaignData.html_content,
      text: campaignData.text_content,
      fromName: preparedEmail.from_name,  // Use rotated from_name
      fromEmail: account.email
    };

    console.log(`📧 Processing: ${preparedEmail.to} with subject: "${emailData.subject}" from: ${emailData.fromName}`);

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

    if (result.success) {
      console.log(`✅ SUCCESS: ${preparedEmail.to} sent via ${account.name}`);
      return {
        recipient: preparedEmail.to,
        status: 'sent',
        accountName: account.name,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };
    } else {
      // Enhanced error logging for quota issues
      if (result.error && result.error.includes('QUOTA_EXCEEDED')) {
        console.log(`🚫 QUOTA: ${preparedEmail.to} - Account ${account.name} quota exceeded`);
      }
      
      console.log(`❌ FAILED: ${preparedEmail.to} - ${result.error}`);
      return {
        recipient: preparedEmail.to,
        status: 'failed',
        error: result.error,
        accountName: account.name,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`❌ Error processing ${preparedEmail.to}:`, error);
    return {
      recipient: preparedEmail.to,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Main function handler
const sendEmailCampaignZeroDelay = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const startTime = Date.now();

  try {
    const { campaignId, slice, campaignData, accounts, organizationId, globalStartIndex = 0 } = req.body;

    console.log(`🚀 GCF: Received request:`, {
      campaignId,
      preparedEmailsCount: slice?.preparedEmails?.length || 0,
      accountsCount: accounts?.length || 0,
      globalStartIndex
    });

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Function is healthy",
        timestamp: new Date().toISOString()
      });
    }

    // Validate prepared emails structure
    if (!slice?.preparedEmails || !Array.isArray(slice.preparedEmails) || slice.preparedEmails.length === 0) {
      console.error(`❌ GCF: Invalid prepared emails structure`);
      return res.status(400).json({
        success: false,
        error: 'No valid prepared emails provided',
        received: { hasSlice: !!slice, preparedEmailsCount: slice?.preparedEmails?.length || 0 }
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No accounts provided'
      });
    }

    const preparedEmails = slice.preparedEmails;
    console.log(`🚀 GCF: Processing ${preparedEmails.length} prepared emails with ${accounts.length} accounts`);

    // Validate each prepared email
    const validEmails = preparedEmails.filter(email => {
      const isValid = email && 
        email.to && 
        email.subject && 
        email.from_name &&
        email.to.includes('@');
      
      if (!isValid) {
        console.warn(`❌ Invalid email object:`, email);
      }
      
      return isValid;
    });

    if (validEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email objects found in prepared emails',
        sample: preparedEmails[0]
      });
    }

    console.log(`✅ GCF: ${validEmails.length}/${preparedEmails.length} emails are valid`);

    // Process emails with account rotation
    const results = [];
    let totalSent = 0;
    let quotaExceededAccounts = new Set();
    
    for (let i = 0; i < validEmails.length; i++) {
      const preparedEmail = validEmails[i];
      const globalIndex = globalStartIndex + i;
      const accountIndex = globalIndex % accounts.length;
      const account = accounts[accountIndex];
      
      // Skip if account quota exceeded
      if (quotaExceededAccounts.has(account.id)) {
        console.log(`⏭️ Skipping ${preparedEmail.to} - Account ${account.name} quota exceeded`);
        results.push({
          recipient: preparedEmail.to,
          status: 'failed',
          error: 'Account quota exceeded',
          accountName: account.name,
          timestamp: new Date().toISOString()
        });
        continue;
      }
      
      console.log(`📧 Processing email ${i + 1}/${validEmails.length}: ${preparedEmail.to} via ${account.name}`);
      
      const result = await processEmail(preparedEmail, account, campaignData, globalIndex, accounts.length);
      results.push(result);
      
      if (result.status === 'sent') {
        totalSent++;
      } else if (result.error && result.error.includes('QUOTA_EXCEEDED')) {
        quotaExceededAccounts.add(account.id);
        console.log(`🚫 QUOTA: Account ${account.name} marked as quota exceeded`);
      }
      
      // Update progress every 10 emails
      if ((i + 1) % 10 === 0 || i === validEmails.length - 1) {
        try {
          await supabase
            .from('email_campaigns')
            .update({ sent_count: supabase.sql`sent_count + ${totalSent - (results.filter(r => r.status === 'sent').length - totalSent)}` })
            .eq('id', campaignId);
            
          console.log(`📝 GCF: Updated sent count`);
        } catch (error) {
          console.error(`❌ GCF: Progress update failed:`, error);
        }
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const quotaFailures = results.filter(r => r.error && r.error.includes('quota')).length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / validEmails.length) * 100);

    console.log(`✅ GCF: COMPLETED - ${totalSent} sent, ${failedCount} failed (${quotaFailures} quota), ${successRate}% in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: validEmails.length,
      sent: totalSent,
      failed: failedCount,
      quotaExceeded: quotaFailures,
      quotaExceededAccounts: Array.from(quotaExceededAccounts),
      successRate,
      processingTimeMs: processingTime,
      results: results.slice(-5) // Last 5 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ GCF: Critical function error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
