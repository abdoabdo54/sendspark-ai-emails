
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
      secure: config.port === 465, // true for 465, false for other ports
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
      // Additional optimizations
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 75000
    });
  }
  return null;
}

// Ultra-fast SMTP sending with parallel processing
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

// Process email with ultra-fast SMTP optimization
async function processEmailUltraFast(preparedEmail, account, campaignData, globalIndex, totalAccounts) {
  try {
    const emailData = {
      to: preparedEmail.to,
      subject: preparedEmail.subject,
      html: campaignData.html_content,
      text: campaignData.text_content,
      fromName: preparedEmail.from_name,
      fromEmail: account.email
    };

    console.log(`📧 ULTRA-FAST SMTP: ${preparedEmail.to} with subject: "${emailData.subject}" from: ${emailData.fromName}`);

    let result;

    if (account.type === 'smtp') {
      const transporter = createUltraFastTransporter(account);
      if (transporter) {
        result = await sendViaUltraFastSMTP(transporter, emailData);
        // Don't close transporter immediately for ultra-fast mode
      } else {
        result = { success: false, error: 'Failed to create ultra-fast SMTP transporter' };
      }
    } else {
      result = { success: false, error: `Ultra-fast mode only supports SMTP. Got: ${account.type}` };
    }

    if (result.success) {
      console.log(`✅ ULTRA-FAST SUCCESS: ${preparedEmail.to} sent via ${account.name}`);
      return {
        recipient: preparedEmail.to,
        status: 'sent',
        accountName: account.name,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`❌ ULTRA-FAST FAILED: ${preparedEmail.to} - ${result.error}`);
      return {
        recipient: preparedEmail.to,
        status: 'failed',
        error: result.error,
        accountName: account.name,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error(`❌ Ultra-fast processing error ${preparedEmail.to}:`, error);
    return {
      recipient: preparedEmail.to,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Main ultra-fast function handler
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
    const { campaignId, slice, campaignData, accounts, organizationId, globalStartIndex = 0, ultraFastMode } = req.body;

    console.log(`🚀 ULTRA-FAST GCF: Received request:`, {
      campaignId,
      preparedEmailsCount: slice?.preparedEmails?.length || 0,
      accountsCount: accounts?.length || 0,
      ultraFastMode,
      globalStartIndex
    });

    // Health check
    if (!campaignId) {
      return res.status(200).json({
        success: true,
        message: "Ultra-fast function is healthy",
        timestamp: new Date().toISOString()
      });
    }

    // Validate prepared emails structure
    if (!slice?.preparedEmails || !Array.isArray(slice.preparedEmails) || slice.preparedEmails.length === 0) {
      console.error(`❌ ULTRA-FAST GCF: Invalid prepared emails structure`);
      return res.status(400).json({
        success: false,
        error: 'No valid prepared emails provided',
        received: { hasSlice: !!slice, preparedEmailsCount: slice?.preparedEmails?.length || 0 }
      });
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No SMTP accounts provided for ultra-fast sending'
      });
    }

    // Filter for SMTP accounts only in ultra-fast mode
    const smtpAccounts = accounts.filter(account => account.type === 'smtp');
    if (smtpAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ultra-fast mode requires SMTP accounts only'
      });
    }

    const preparedEmails = slice.preparedEmails;
    console.log(`🚀 ULTRA-FAST GCF: Processing ${preparedEmails.length} prepared emails with ${smtpAccounts.length} SMTP accounts`);

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

    console.log(`✅ ULTRA-FAST GCF: ${validEmails.length}/${preparedEmails.length} emails are valid`);

    // Create transporter pool for ultra-fast processing
    const transporters = new Map();
    for (const account of smtpAccounts) {
      const transporter = createUltraFastTransporter(account);
      if (transporter) {
        transporters.set(account.id, transporter);
      }
    }

    console.log(`🚀 ULTRA-FAST: Created ${transporters.size} transporter pools`);

    // Process emails with ultra-fast parallel processing
    const results = [];
    let totalSent = 0;
    
    // Process in batches for ultra-fast sending
    const batchSize = Math.min(50, Math.ceil(validEmails.length / smtpAccounts.length));
    const batches = [];
    
    for (let i = 0; i < validEmails.length; i += batchSize) {
      batches.push(validEmails.slice(i, i + batchSize));
    }

    console.log(`🚀 ULTRA-FAST: Processing ${batches.length} batches of ~${batchSize} emails each`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchPromises = batch.map(async (preparedEmail, emailIndex) => {
        const globalIndex = globalStartIndex + (batchIndex * batchSize) + emailIndex;
        const accountIndex = globalIndex % smtpAccounts.length;
        const account = smtpAccounts[accountIndex];
        
        return processEmailUltraFast(preparedEmail, account, campaignData, globalIndex, smtpAccounts.length);
      });

      // Process batch in parallel for ultra-fast sending
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      const batchSentCount = batchResults.filter(r => r.status === 'sent').length;
      totalSent += batchSentCount;
      
      console.log(`✅ ULTRA-FAST: Batch ${batchIndex + 1}/${batches.length} completed - ${batchSentCount}/${batch.length} sent`);
    }

    // Close all transporters
    for (const transporter of transporters.values()) {
      transporter.close();
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / validEmails.length) * 100);

    console.log(`✅ ULTRA-FAST GCF: COMPLETED - ${totalSent} sent, ${failedCount} failed, ${successRate}% in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: validEmails.length,
      sent: totalSent,
      failed: failedCount,
      successRate,
      processingTimeMs: processingTime,
      ultraFastMode: true,
      results: results.slice(-10) // Last 10 for debugging
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ ULTRA-FAST GCF: Critical function error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMs: processingTime,
      ultraFastMode: true
    });
  }
};

// Register the function
functions.http('sendEmailCampaignZeroDelay', sendEmailCampaignZeroDelay);
