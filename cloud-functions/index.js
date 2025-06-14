
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

// Send email via Apps Script
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
    return result.status === 'success' || result.success 
      ? { success: true, messageId: result.messageId || 'apps-script-sent' }
      : { success: false, error: result.message || result.error || 'Apps Script error' };
      
  } catch (error) {
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

// CRITICAL: Process prepared email with proper data structure
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

    // CRITICAL: Validate prepared emails structure
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

    // Validate each prepared email has required fields
    const validEmails = preparedEmails.filter(email => 
      email && 
      email.to && 
      email.subject && 
      email.from_name &&
      email.to.includes('@')
    );

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
    
    for (let i = 0; i < validEmails.length; i++) {
      const preparedEmail = validEmails[i];
      const globalIndex = globalStartIndex + i;
      const accountIndex = globalIndex % accounts.length;
      const account = accounts[accountIndex];
      
      console.log(`📧 Processing email ${i + 1}/${validEmails.length}: ${preparedEmail.to} via ${account.name}`);
      
      const result = await processEmail(preparedEmail, account, campaignData, globalIndex, accounts.length);
      results.push(result);
      
      if (result.status === 'sent') {
        totalSent++;
      }
      
      // Update progress in database every 10 emails
      if ((i + 1) % 10 === 0 || i === validEmails.length - 1) {
        try {
          const { data: currentCampaign } = await supabase
            .from('email_campaigns')
            .select('sent_count')
            .eq('id', campaignId)
            .single();

          const newSentCount = (currentCampaign?.sent_count || 0) + (totalSent - (results.length - (i + 1) === 0 ? totalSent : 0));
          
          await supabase
            .from('email_campaigns')
            .update({ sent_count: newSentCount })
            .eq('id', campaignId);
            
          console.log(`📝 GCF: Updated sent count to ${newSentCount}`);
        } catch (error) {
          console.error(`❌ GCF: Progress update failed:`, error);
        }
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const processingTime = Date.now() - startTime;
    const successRate = Math.round((totalSent / validEmails.length) * 100);

    console.log(`✅ GCF: COMPLETED - ${totalSent} sent, ${failedCount} failed (${successRate}%) in ${processingTime}ms`);

    res.status(200).json({
      success: true,
      campaignId,
      processed: validEmails.length,
      sent: totalSent,
      failed: failedCount,
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
