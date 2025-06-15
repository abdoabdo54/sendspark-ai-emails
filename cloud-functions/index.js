const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Ultra-fast SMTP transporter configuration - RESTORED WORKING VERSION
function createUltraFastTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    try {
      console.log(`🔧 Creating SMTP transporter for ${account.name}:`, {
        host: config.host,
        port: config.port,
        username: config.username || config.user,
        hasPassword: !!(config.password || config.pass)
      });

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
    } catch (error) {
      console.error(`❌ Failed to create SMTP transporter for ${account.name}:`, error.message);
      return null;
    }
  }
  return null;
}

// Ultra-fast SMTP sending - RESTORED WORKING VERSION
async function sendViaUltraFastSMTP(transporter, emailData, accountName) {
  try {
    console.log(`📧 SMTP: Attempting to send email to ${emailData.to} via ${accountName}`);
    
    if (!transporter) {
      throw new Error('SMTP transporter is not available');
    }

    const info = await transporter.sendMail({
      from: `"${emailData.fromName}" <${emailData.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html?.replace(/<[^>]*>/g, '') || ''
    });

    console.log(`✅ SMTP Success for ${emailData.to} via ${accountName}:`, {
      messageId: info.messageId,
      response: info.response
    });

    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error(`❌ SMTP Error for ${emailData.to} via ${accountName}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Enhanced Apps Script implementation with better error handling and timeout
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

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

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
    if (error.name === 'AbortError') {
      return { success: false, error: 'Apps Script request timed out after 45 seconds' };
    }
    return { success: false, error: error.message };
  }
}

// Enhanced email processing with better SMTP handling
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
      console.log(`🔧 SMTP: Creating transporter for ${account.name}`);
      const transporter = createUltraFastTransporter(account);
      
      if (!transporter) {
        console.error(`❌ SMTP: Failed to create transporter for ${account.name}`);
        return {
          recipient: preparedEmail.to,
          status: 'failed',
          error: 'Failed to create SMTP transporter - check SMTP configuration',
          accountName: account.name,
          accountType: account.type,
          timestamp: new Date().toISOString()
        };
      }

      try {
        result = await sendViaUltraFastSMTP(transporter, emailData, account.name);
      } finally {
        // Always close transporter
        try {
          if (transporter && typeof transporter.close === 'function') {
            transporter.close();
          }
        } catch (closeError) {
          console.warn(`⚠️ SMTP: Error closing transporter for ${account.name}:`, closeError.message);
        }
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
        timestamp: new Date().toISOString(),
        details: result.response
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

// Enhanced main function handler with comprehensive error handling and logging
const sendEmailCampaignZeroDelay = async (req, res) => {
  // Enhanced CORS headers - this fixes the main issue
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Parallel-Mode, X-Function-Index, X-Total-Functions, Accept, Cache-Control',
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'false'
  };

  // Set all CORS headers
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
  const parallelMode = req.headers['x-parallel-mode'] === 'true';

  // Enhanced request logging
  console.log(`🚀 HYBRID GCF F${functionIndex}/${totalFunctions}: Request received`, {
    method: req.method,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent'],
    parallelMode,
    timestamp: new Date().toISOString()
  });

  try {
    // Enhanced request body parsing with error handling
    let requestBody;
    try {
      requestBody = req.body;
      if (!requestBody) {
        throw new Error('Request body is empty or undefined');
      }
    } catch (parseError) {
      console.error(`❌ Request body parsing error:`, parseError);
      return res.status(400).json({
        success: false,
        error: `Failed to parse request body: ${parseError.message}`,
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    const { 
      campaignId, 
      slice, 
      campaignData, 
      accounts, 
      organizationId, 
      globalStartIndex = 0, 
      forceParallelExecution = false,
      ultraFastMode = false
    } = requestBody;

    console.log(`🚀 HYBRID GCF F${functionIndex}/${totalFunctions}: Starting ULTRA-FAST processing`, {
      campaignId,
      preparedEmailsCount: slice?.preparedEmails?.length || 0,
      accountsCount: accounts?.length || 0,
      parallelMode,
      forceParallelExecution,
      ultraFastMode,
      globalStartIndex,
      requestSizeKB: Math.round(JSON.stringify(requestBody).length / 1024)
    });

    // Health check with enhanced response
    if (!campaignId || (requestBody.test && requestBody.ping === 'health-check')) {
      return res.status(200).json({
        success: true,
        message: "Enhanced Hybrid function is healthy and ready",
        functionIndex: parseInt(functionIndex) || 0,
        timestamp: new Date().toISOString(),
        version: "6.1.0-enhanced",
        capabilities: ["smtp", "apps-script", "parallel-processing", "enhanced-error-handling"],
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      });
    }

    // Enhanced validation with detailed error messages
    if (!slice?.preparedEmails || !Array.isArray(slice.preparedEmails) || slice.preparedEmails.length === 0) {
      console.error(`❌ HYBRID GCF F${functionIndex}: Invalid prepared emails structure`, {
        hasSlice: !!slice,
        preparedEmailsType: typeof slice?.preparedEmails,
        preparedEmailsLength: slice?.preparedEmails?.length || 0
      });
      return res.status(400).json({
        success: false,
        error: 'No valid prepared emails provided',
        details: {
          hasSlice: !!slice,
          preparedEmailsType: typeof slice?.preparedEmails,
          preparedEmailsCount: slice?.preparedEmails?.length || 0
        },
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      console.error(`❌ HYBRID GCF F${functionIndex}: Invalid accounts structure`, {
        hasAccounts: !!accounts,
        accountsType: typeof accounts,
        accountsLength: accounts?.length || 0
      });
      return res.status(400).json({
        success: false,
        error: 'No accounts provided for hybrid sending',
        details: {
          hasAccounts: !!accounts,
          accountsType: typeof accounts,
          accountsCount: accounts?.length || 0
        },
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    // Separate SMTP and Apps Script accounts with validation
    const smtpAccounts = accounts.filter(account => account.type === 'smtp');
    const appsScriptAccounts = accounts.filter(account => account.type === 'apps-script');
    const allAccounts = [...smtpAccounts, ...appsScriptAccounts];

    if (allAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid SMTP or Apps Script accounts found',
        details: {
          totalAccounts: accounts.length,
          smtpAccounts: smtpAccounts.length,
          appsScriptAccounts: appsScriptAccounts.length
        },
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    const preparedEmails = slice.preparedEmails;
    console.log(`🚀 HYBRID GCF F${functionIndex}: Processing ${preparedEmails.length} emails with ${smtpAccounts.length} SMTP + ${appsScriptAccounts.length} Apps Script accounts`);

    // Enhanced email validation
    const validEmails = preparedEmails.filter(email => {
      const isValid = email && 
        email.to && 
        email.subject && 
        email.from_name &&
        email.to.includes('@') &&
        email.to.length > 0 &&
        email.subject.length > 0;
      
      if (!isValid) {
        console.warn(`❌ Invalid email object:`, {
          hasTo: !!email?.to,
          hasSubject: !!email?.subject,
          hasFromName: !!email?.from_name,
          toValid: email?.to?.includes('@') && email?.to?.length > 0,
          email: email?.to || 'undefined'
        });
      }
      
      return isValid;
    });

    if (validEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email objects found in prepared emails',
        details: {
          totalEmails: preparedEmails.length,
          validEmails: validEmails.length,
          sampleEmail: preparedEmails[0]
        },
        functionIndex: parseInt(functionIndex) || 0
      });
    }

    console.log(`✅ HYBRID GCF F${functionIndex}: ${validEmails.length}/${preparedEmails.length} emails are valid`);

    // Enhanced parallel processing with better error handling
    console.log(`🔥 HYBRID F${functionIndex}: FIRING ALL ${validEmails.length} EMAILS IN TRUE PARALLEL MODE`);
    
    const startProcessingTime = Date.now();
    
    // Create all promises with enhanced error handling
    const allEmailPromises = validEmails.map(async (preparedEmail, emailIndex) => {
      try {
        const globalIndex = globalStartIndex + emailIndex;
        const accountIndex = globalIndex % allAccounts.length;
        const account = allAccounts[accountIndex];
        
        // Add small stagger for SMTP connections to avoid overwhelming
        if (account.type === 'smtp' && emailIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.floor(emailIndex / 10) * 10)); // 10ms stagger per 10 emails
        }
        
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

    // Execute all promises with enhanced error handling
    console.log(`⚡ HYBRID F${functionIndex}: Executing ${allEmailPromises.length} promises with Promise.all`);
    const allResults = await Promise.all(allEmailPromises);
    
    const processingTime = Date.now() - startProcessingTime;
    console.log(`⚡ HYBRID F${functionIndex}: All ${allResults.length} emails processed in ${processingTime}ms`);

    // Enhanced result analysis
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

    // Enhanced failure analysis
    const failures = allResults.filter(r => r.status === 'failed');
    const failuresByType = {
      smtp: failures.filter(r => r.accountType === 'smtp'),
      appsScript: failures.filter(r => r.accountType === 'apps-script'),
      unknown: failures.filter(r => !r.accountType)
    };

    if (failures.length > 0) {
      console.error('❌ DETAILED Failure Analysis:');
      Object.entries(failuresByType).forEach(([type, typeFailures]) => {
        if (typeFailures.length > 0) {
          console.error(`  ${type.toUpperCase()} Failures (${typeFailures.length}):`);
          typeFailures.slice(0, 5).forEach(f => {
            console.error(`    • ${f.recipient}: ${f.error} (Account: ${f.accountName})`);
          });
        }
      });
    }

    // Enhanced response with comprehensive details
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
      version: "6.1.0-enhanced",
      breakdown: {
        smtp: { sent: smtpSent, failed: smtpFailed },
        appsScript: { sent: appsScriptSent, failed: appsScriptFailed }
      },
      performance: {
        requestSizeKB: Math.round(JSON.stringify(requestBody).length / 1024),
        memoryUsage: process.memoryUsage(),
        totalTime: totalProcessingTime,
        processingTime: processingTime
      },
      results: allResults.slice(-5), // Last 5 for debugging
      failures: failures.slice(0, 10), // First 10 failures for debugging
      detailedFailures: failures.map(f => ({
        email: f.recipient,
        error: f.error,
        account: f.accountName,
        type: f.accountType
      })),
      failureAnalysis: {
        byType: {
          smtp: failuresByType.smtp.length,
          appsScript: failuresByType.appsScript.length,
          unknown: failuresByType.unknown.length
        },
        commonErrors: [...new Set(failures.map(f => f.error))].slice(0, 5)
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ HYBRID GCF F${functionIndex}: Critical function error:`, {
      error: error.message,
      stack: error.stack,
      processingTime,
      memoryUsage: process.memoryUsage()
    });

    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      functionIndex: parseInt(functionIndex) || 0,
      parallelMode: true,
      version: "6.1.0-enhanced",
      errorDetails: {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
        memoryUsage: process.memoryUsage()
      }
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
