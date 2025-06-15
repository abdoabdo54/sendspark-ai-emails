const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Ultra-fast SMTP transporter configuration - MAXIMUM SPEED
function createUltraFastTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    return nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.port === 465,
      auth: {
        user: config.username || config.user,
        pass: config.password || config.pass
      },
      // MAXIMUM SPEED SETTINGS - NO LIMITS
      pool: true,
      maxConnections: 200, // Increased even more
      maxMessages: Infinity, // No message limit
      rateDelta: 0, // No rate limiting
      rateLimit: false, // Disable rate limiting completely
      connectionTimeout: 180000, // 3 minutes
      greetingTimeout: 90000, // 1.5 minutes
      socketTimeout: 180000, // 3 minutes
      // Additional speed optimizations
      disableFileAccess: true,
      disableUrlAccess: true,
      keepAlive: true,
      // Remove any delays
      sendTimeout: 0,
      idleTimeout: 0,
      // Disable all authentication checks that could slow down
      ignoreTLS: false,
      requireTLS: false
    });
  }
  return null;
}

// Ultra-fast SMTP sending - NO DELAYS
async function sendViaUltraFastSMTP(transporter, emailData) {
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
    console.error(`SMTP Error for ${emailData.to}:`, error.message);
    return { success: false, error: error.message };
  }
}

// WORKING Apps Script implementation - restored from previous version
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    
    // Use exec_url if available, fallback to script_url for backward compatibility
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

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {})
      },
      body: JSON.stringify(payload),
      timeout: 45000 // 45 second timeout for Apps Script
    });

    console.log(`📧 Apps Script Response Status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`📧 Apps Script Result:`, result);
      
      // Handle various success response formats from Apps Script
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
      console.error(`❌ Apps Script HTTP Error: ${response.status} - ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    console.error(`❌ Apps Script Error for ${emailData.to}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Process email with hybrid method (SMTP + Apps Script) - ENHANCED
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

    console.log(`📧 HYBRID: Processing ${preparedEmail.to} via ${account.type.toUpperCase()} (${account.name})`);

    let result;

    if (account.type === 'smtp') {
      const transporter = createUltraFastTransporter(account);
      if (transporter) {
        result = await sendViaUltraFastSMTP(transporter, emailData);
        // Close transporter after use
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
      console.log(`✅ HYBRID SUCCESS: ${preparedEmail.to} sent via ${account.type.toUpperCase()} (${account.name})`);
      return {
        recipient: preparedEmail.to,
        status: 'sent',
        accountName: account.name,
        accountType: account.type,
        messageId: result.messageId,
        remainingQuota: result.remainingQuota,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`❌ HYBRID FAILED: ${preparedEmail.to} via ${account.type.toUpperCase()} - ${result.error}`);
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
    console.error(`❌ Hybrid processing error ${preparedEmail.to}:`, error);
    return {
      recipient: preparedEmail.to,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// CRITICAL FIX: Main hybrid function handler with GUARANTEED parallel execution
const sendEmailCampaignZeroDelay = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Parallel-Mode, X-Function-Index, X-Total-Functions');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const startTime = Date.now();
  const functionIndex = req.headers['x-function-index'] || 'unknown';
  const totalFunctions = req.headers['x-total-functions'] || 'unknown';
  const parallelMode = req.headers['x-parallel-mode'] === 'true';

  try {
    const { 
      campaignId, 
      slice, 
      campaignData, 
      accounts, 
      organizationId, 
      globalStartIndex = 0, 
      forceParallelExecution = false,
      ultraFastMode = false
    } = req.body;

    console.log(`🚀 HYBRID GCF F${functionIndex}/${totalFunctions}: Starting ULTRA-FAST processing`, {
      campaignId,
      preparedEmailsCount: slice?.preparedEmails?.length || 0,
      accountsCount: accounts?.length || 0,
      parallelMode,
      forceParallelExecution,
      ultraFastMode,
      globalStartIndex
    });

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Hybrid function is healthy",
        timestamp: new Date().toISOString()
      });
    }

    // Validate prepared emails structure
    if (!slice?.preparedEmails || !Array.isArray(slice.preparedEmails) || slice.preparedEmails.length === 0) {
      console.error(`❌ HYBRID GCF F${functionIndex}: Invalid prepared emails structure`);
      return res.status(400).json({
        success: false,
        error: 'No valid prepared emails provided',
        received: { hasSlice: !!slice, preparedEmailsCount: slice?.preparedEmails?.length || 0 }
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No accounts provided for hybrid sending'
      });
    }

    // Separate SMTP and Apps Script accounts
    const smtpAccounts = accounts.filter(account => account.type === 'smtp');
    const appsScriptAccounts = accounts.filter(account => account.type === 'apps-script');
    const allAccounts = [...smtpAccounts, ...appsScriptAccounts];

    if (allAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid SMTP or Apps Script accounts found'
      });
    }

    const preparedEmails = slice.preparedEmails;
    console.log(`🚀 HYBRID GCF F${functionIndex}: Processing ${preparedEmails.length} emails with ${smtpAccounts.length} SMTP + ${appsScriptAccounts.length} Apps Script accounts`);

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

    console.log(`✅ HYBRID GCF F${functionIndex}: ${validEmails.length}/${preparedEmails.length} emails are valid`);

    // CRITICAL FIX: GUARANTEED parallel processing using Promise.all
    console.log(`🔥 HYBRID F${functionIndex}: FIRING ALL ${validEmails.length} EMAILS IN TRUE PARALLEL MODE`);
    
    const startProcessingTime = Date.now();
    
    // Create all promises FIRST - this is critical for true parallelism
    const allEmailPromises = validEmails.map(async (preparedEmail, emailIndex) => {
      const globalIndex = globalStartIndex + emailIndex;
      const accountIndex = globalIndex % allAccounts.length;
      const account = allAccounts[accountIndex];
      
      // Add small stagger for SMTP connections to avoid overwhelming
      if (account.type === 'smtp' && emailIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.floor(emailIndex / 10) * 10)); // 10ms stagger per 10 emails
      }
      
      return processEmailHybrid(preparedEmail, account, campaignData, globalIndex, allAccounts.length);
    });

    // CRITICAL: Execute ALL promises in parallel with Promise.all
    console.log(`⚡ HYBRID F${functionIndex}: Executing ${allEmailPromises.length} promises with Promise.all`);
    const allResults = await Promise.all(allEmailPromises);
    
    const processingTime = Date.now() - startProcessingTime;
    console.log(`⚡ HYBRID F${functionIndex}: All ${allResults.length} emails processed in ${processingTime}ms`);

    const totalSent = allResults.filter(r => r.status === 'sent').length;
    const failedCount = allResults.filter(r => r.status === 'failed').length;
    const totalProcessingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / validEmails.length) * 100);
    const emailsPerSecond = Math.round(totalSent / (processingTime / 1000));

    // Calculate method breakdown
    const smtpSent = allResults.filter(r => r.status === 'sent' && r.accountType === 'smtp').length;
    const appsScriptSent = allResults.filter(r => r.status === 'sent' && r.accountType === 'apps-script').length;
    const smtpFailed = allResults.filter(r => r.status === 'failed' && r.accountType === 'smtp').length;
    const appsScriptFailed = allResults.filter(r => r.status === 'failed' && r.accountType === 'apps-script').length;

    console.log(`✅ HYBRID GCF F${functionIndex}: COMPLETED - ${totalSent} sent (${smtpSent} SMTP, ${appsScriptSent} Apps Script), ${failedCount} failed (${smtpFailed} SMTP, ${appsScriptFailed} Apps Script), ${successRate}% in ${totalProcessingTime}ms (${emailsPerSecond} emails/sec)`);

    // Log detailed Apps Script failures for debugging
    const appsScriptFailures = allResults.filter(r => r.status === 'failed' && r.accountType === 'apps-script');
    if (appsScriptFailures.length > 0) {
      console.error('❌ DETAILED Apps Script Failures:');
      appsScriptFailures.forEach(f => {
        console.error(`  • ${f.recipient}: ${f.error} (Account: ${f.accountName})`);
      });
    }

    res.status(200).json({
      success: true,
      campaignId,
      functionIndex: parseInt(functionIndex) || 0,
      totalFunctions: parseInt(totalFunctions) || 1,
      processed: validEmails.length,
      sent: totalSent,
      failed: failedCount,
      successRate,
      processingTimeMs: totalProcessingTime,
      emailsPerSecond,
      parallelMode: true,
      ultraFastMode: true,
      breakdown: {
        smtp: { sent: smtpSent, failed: smtpFailed },
        appsScript: { sent: appsScriptSent, failed: appsScriptFailed }
      },
      results: allResults.slice(-5), // Last 5 for debugging
      failures: appsScriptFailures.slice(0, 10), // First 10 Apps Script failures for debugging
      detailedFailures: appsScriptFailures.map(f => ({
        email: f.recipient,
        error: f.error,
        account: f.accountName,
        type: f.accountType
      }))
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ HYBRID GCF F${functionIndex}: Critical function error:`, error);

    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      functionIndex: parseInt(functionIndex) || 0,
      parallelMode: true
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
