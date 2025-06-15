
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple SMTP transporter creation
function createSMTPTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    
    console.log(`🔧 Creating SMTP transporter for ${account.name}:`, {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user || config.username,
        pass: config.pass || config.password
      }
    });

    // Normalize configuration
    const smtpConfig = {
      host: config.host,
      port: parseInt(config.port) || 587,
      secure: config.secure || config.port == 465,
      auth: {
        user: config.user || config.username,
        pass: config.pass || config.password
      },
      // Add connection settings for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10
    };

    // Validate required fields
    if (!smtpConfig.host) {
      console.error(`❌ Missing SMTP host for ${account.name}`);
      return null;
    }
    
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.error(`❌ Missing SMTP credentials for ${account.name}`);
      return null;
    }

    try {
      const transporter = nodemailer.createTransporter(smtpConfig);
      console.log(`✅ SMTP transporter created for ${account.name}`);
      return transporter;
    } catch (error) {
      console.error(`❌ Failed to create SMTP transporter for ${account.name}:`, error.message);
      return null;
    }
  }
  return null;
}

// SMTP sending function
async function sendViaSMTP(transporter, emailData, accountName) {
  try {
    console.log(`📧 SMTP: Sending email to ${emailData.to} via ${accountName}`);
    
    const mailOptions = {
      from: `"${emailData.fromName}" <${emailData.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html?.replace(/<[^>]*>/g, '') || ''
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ SMTP Success for ${emailData.to} via ${accountName}:`, info.messageId);

    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error(`❌ SMTP Error for ${emailData.to} via ${accountName}:`, error.message);
    return { 
      success: false, 
      error: error.message
    };
  }
}

// Apps Script implementation
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    const scriptUrl = config.exec_url || config.script_url;
    
    if (!scriptUrl) {
      return { success: false, error: 'Apps Script execution URL not configured' };
    }

    const payload = {
      to: emailData.to,
      subject: emailData.subject,
      htmlBody: emailData.html,
      plainBody: emailData.text || '',
      fromName: emailData.fromName,
      fromAlias: emailData.fromEmail
    };

    console.log(`📧 Apps Script: Sending to ${emailData.to} via ${scriptUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success' || result.success === true || result.result === 'success') {
        return { 
          success: true, 
          remainingQuota: result.remainingQuota || result.remaining_quota,
          messageId: result.messageId || result.message_id
        };
      } else {
        return { 
          success: false, 
          error: result.message || result.error || result.details || 'Apps Script returned non-success status' 
        };
      }
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Apps Script request timed out after 45 seconds' };
    }
    return { success: false, error: error.message };
  }
}

// Enhanced email processing
async function processEmailHybrid(preparedEmail, account, campaignData, globalIndex, totalAccounts) {
  try {
    const emailData = {
      to: preparedEmail.to,
      subject: preparedEmail.subject,
      html: campaignData.html_content,
      text: campaignData.text_content,
      fromName: preparedEmail.from_name,
      fromEmail: account.email
    };

    console.log(`📧 Processing ${preparedEmail.to} via ${account.type.toUpperCase()} (${account.name})`);

    let result;

    if (account.type === 'smtp') {
      const transporter = createSMTPTransporter(account);
      
      if (!transporter) {
        return {
          recipient: preparedEmail.to,
          status: 'failed',
          error: 'Failed to create SMTP transporter',
          accountName: account.name,
          accountType: account.type,
          timestamp: new Date().toISOString()
        };
      }

      result = await sendViaSMTP(transporter, emailData, account.name);
      
      // Close transporter
      if (transporter && typeof transporter.close === 'function') {
        transporter.close();
      }
    } else if (account.type === 'apps-script') {
      result = await sendViaAppsScript(account, emailData);
    } else {
      result = { success: false, error: `Unsupported account type: ${account.type}` };
    }

    if (result.success) {
      console.log(`✅ SUCCESS: ${preparedEmail.to} sent via ${account.type.toUpperCase()} (${account.name})`);
      return {
        recipient: preparedEmail.to,
        status: 'sent',
        accountName: account.name,
        accountType: account.type,
        messageId: result.messageId,
        remainingQuota: result.remainingQuota,
        timestamp: new Date().toISOString(),
        details: result.response || result.details
      };
    } else {
      console.log(`❌ FAILED: ${preparedEmail.to} via ${account.type.toUpperCase()} - ${result.error}`);
      return {
        recipient: preparedEmail.to,
        status: 'failed',
        error: result.error,
        accountName: account.name,
        accountType: account.type,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`❌ Processing error ${preparedEmail.to}:`, error);
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Parallel-Mode, X-Function-Index, X-Total-Functions, Accept, Cache-Control',
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'false'
  };

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.set(key, value);
  });

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const startTime = Date.now();
  const functionIndex = req.headers['x-function-index'] || 'unknown';
  const totalFunctions = req.headers['x-total-functions'] || 'unknown';

  console.log(`🚀 HYBRID GCF F${functionIndex}/${totalFunctions}: Request received`);

  try {
    const requestBody = req.body;
    
    if (!requestBody) {
      throw new Error('Request body is empty or undefined');
    }

    const { 
      campaignId, 
      slice, 
      campaignData, 
      accounts, 
      organizationId, 
      globalStartIndex = 0 
    } = requestBody;

    // Health check
    if (!campaignId || (requestBody.test && requestBody.ping === 'health-check')) {
      return res.status(200).json({
        success: true,
        message: "Hybrid function is healthy and ready",
        functionIndex: parseInt(functionIndex) || 0,
        timestamp: new Date().toISOString(),
        version: "fixed-smtp"
      });
    }

    // Validation
    if (!slice?.preparedEmails || !Array.isArray(slice.preparedEmails) || slice.preparedEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid prepared emails provided',
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No accounts provided for hybrid sending',
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    const preparedEmails = slice.preparedEmails;
    const allAccounts = accounts;

    console.log(`🚀 Processing ${preparedEmails.length} emails with ${allAccounts.length} accounts`);

    // Process all emails in parallel
    const allEmailPromises = preparedEmails.map(async (preparedEmail, emailIndex) => {
      try {
        const globalIndex = globalStartIndex + emailIndex;
        const accountIndex = globalIndex % allAccounts.length;
        const account = allAccounts[accountIndex];
        
        return await processEmailHybrid(preparedEmail, account, campaignData, globalIndex, allAccounts.length);
      } catch (error) {
        console.error(`❌ Promise error for email ${emailIndex}:`, error);
        return {
          recipient: preparedEmail.to,
          status: 'failed',
          error: `Promise execution error: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }
    });

    const allResults = await Promise.all(allEmailPromises);
    
    const totalSent = allResults.filter(r => r.status === 'sent').length;
    const failedCount = allResults.filter(r => r.status === 'failed').length;
    const totalProcessingTime = Date.now() - startTime;

    const smtpSent = allResults.filter(r => r.status === 'sent' && r.accountType === 'smtp').length;
    const appsScriptSent = allResults.filter(r => r.status === 'sent' && r.accountType === 'apps-script').length;

    console.log(`✅ COMPLETED - ${totalSent} sent (${smtpSent} SMTP, ${appsScriptSent} Apps Script), ${failedCount} failed in ${totalProcessingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      functionIndex: parseInt(functionIndex) || 0,
      processed: preparedEmails.length,
      sent: totalSent,
      failed: failedCount,
      processingTimeMs: totalProcessingTime,
      breakdown: {
        smtp: { sent: smtpSent },
        appsScript: { sent: appsScriptSent }
      },
      results: allResults.slice(-5),
      failures: allResults.filter(r => r.status === 'failed').slice(0, 10)
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Critical function error:`, error);

    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      functionIndex: parseInt(functionIndex) || 0
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
