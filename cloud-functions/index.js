
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Ultra-fast SMTP transporter configuration
function createUltraFastTransporter(account) {
  if (account.type === 'smtp') {
    const config = account.config || {};
    return nodemailer.createTransporter({
      host: config.host,
      port: config.port || 587,
      secure: config.port === 465,
      auth: {
        user: config.username || config.user,
        pass: config.password || config.pass
      },
      // Ultra-fast settings
      pool: true,
      maxConnections: config.maxConnections || 50,
      maxMessages: config.maxMessages || 100,
      rateDelta: config.rateDelta || 1000,
      rateLimit: config.rateLimit || 50,
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 75000
    });
  }
  return null;
}

// Ultra-fast SMTP sending
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
    return { success: false, error: error.message };
  }
}

// Fast Apps Script sending
async function sendViaAppsScript(account, emailData) {
  try {
    const config = account.config || {};
    
    const payload = {
      to: emailData.to,
      subject: emailData.subject,
      htmlBody: emailData.html,
      plainBody: emailData.text || '',
      fromName: emailData.fromName,
      fromAlias: emailData.fromEmail
    };

    const response = await fetch(config.exec_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success') {
        return { success: true, remainingQuota: result.remainingQuota };
      } else {
        return { success: false, error: result.message || 'Apps Script error' };
      }
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process email with hybrid method (SMTP + Apps Script)
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

    console.log(`📧 HYBRID: ${preparedEmail.to} via ${account.type.toUpperCase()} (${account.name})`);

    let result;

    if (account.type === 'smtp') {
      const transporter = createUltraFastTransporter(account);
      if (transporter) {
        result = await sendViaUltraFastSMTP(transporter, emailData);
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

// Main hybrid function handler
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
    const { campaignId, slice, campaignData, accounts, organizationId, globalStartIndex = 0, hybridMode, accountDistribution } = req.body;

    console.log(`🚀 HYBRID GCF: Received request:`, {
      campaignId,
      preparedEmailsCount: slice?.preparedEmails?.length || 0,
      accountsCount: accounts?.length || 0,
      hybridMode,
      accountDistribution,
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
      console.error(`❌ HYBRID GCF: Invalid prepared emails structure`);
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
    console.log(`🚀 HYBRID GCF: Processing ${preparedEmails.length} emails with ${smtpAccounts.length} SMTP + ${appsScriptAccounts.length} Apps Script accounts`);

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

    console.log(`✅ HYBRID GCF: ${validEmails.length}/${preparedEmails.length} emails are valid`);

    // Create transporter pool for SMTP accounts
    const transporters = new Map();
    for (const account of smtpAccounts) {
      const transporter = createUltraFastTransporter(account);
      if (transporter) {
        transporters.set(account.id, transporter);
      }
    }

    console.log(`🚀 HYBRID: Created ${transporters.size} SMTP transporters + ${appsScriptAccounts.length} Apps Script accounts`);

    // Process emails with hybrid parallel processing
    const results = [];
    let totalSent = 0;
    
    // Process in batches for optimal performance
    const batchSize = Math.min(50, Math.ceil(validEmails.length / allAccounts.length));
    const batches = [];
    
    for (let i = 0; i < validEmails.length; i += batchSize) {
      batches.push(validEmails.slice(i, i + batchSize));
    }

    console.log(`🚀 HYBRID: Processing ${batches.length} batches of ~${batchSize} emails each`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchPromises = batch.map(async (preparedEmail, emailIndex) => {
        const globalIndex = globalStartIndex + (batchIndex * batchSize) + emailIndex;
        const accountIndex = globalIndex % allAccounts.length;
        const account = allAccounts[accountIndex];
        
        return processEmailHybrid(preparedEmail, account, campaignData, globalIndex, allAccounts.length);
      });

      // Process batch in parallel
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      const batchSentCount = batchResults.filter(r => r.status === 'sent').length;
      totalSent += batchSentCount;
      
      console.log(`✅ HYBRID: Batch ${batchIndex + 1}/${batches.length} completed - ${batchSentCount}/${batch.length} sent`);
    }

    // Close all SMTP transporters
    for (const transporter of transporters.values()) {
      transporter.close();
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / validEmails.length) * 100);

    // Calculate method breakdown
    const smtpSent = results.filter(r => r.status === 'sent' && r.accountType === 'smtp').length;
    const appsScriptSent = results.filter(r => r.status === 'sent' && r.accountType === 'apps-script').length;

    console.log(`✅ HYBRID GCF: COMPLETED - ${totalSent} sent (${smtpSent} SMTP, ${appsScriptSent} Apps Script), ${failedCount} failed, ${successRate}% in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: validEmails.length,
      sent: totalSent,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      hybridMode: true,
      breakdown: {
        smtp: smtpSent,
        appsScript: appsScriptSent
      },
      results: results.slice(-10) // Last 10 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ HYBRID GCF: Critical function error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      hybridMode: true
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
