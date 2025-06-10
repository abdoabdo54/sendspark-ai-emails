
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate delay based on config - simplified to two modes
function calculateDelay(config) {
  const mode = config.sendingMode || 'controlled';
  
  if (mode === 'instant') return 0;  // New instant mode - no delay
  return Math.max(0, (1000 / (config.emailsPerSecond || 1))); // Old controlled mode
}

// Apply rotation
function applyRotation(emailData, index, rotation) {
  let fromName = emailData.fromName;
  let subject = emailData.subject;

  if (rotation.useFromNameRotation && rotation.fromNames?.length > 0) {
    fromName = rotation.fromNames[index % rotation.fromNames.length];
  }

  if (rotation.useSubjectRotation && rotation.subjects?.length > 0) {
    subject = rotation.subjects[index % rotation.subjects.length];
  }

  return { fromName, subject };
}

functions.http('sendEmailCampaign', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    const { 
      campaignId, 
      emailsByAccount, 
      supabaseUrl, 
      supabaseKey,
      config = {},
      rotation = {}
    } = req.body || {};
    
    if (!campaignId || !emailsByAccount || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required parameters');
    }

    console.log(`Processing campaign ${campaignId}`);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const delayMs = calculateDelay(config);
    
    let totalSent = 0;
    let totalFailed = 0;
    let globalEmailIndex = 0;

    // Process each account
    for (const [accountId, accountData] of Object.entries(emailsByAccount)) {
      const { type, config: accountConfig, emails, accountInfo } = accountData;
      
      // Fix: Ensure accountInfo exists and has email property
      const accountEmail = accountInfo?.email || accountConfig?.user || accountConfig?.email || 'unknown@domain.com';
      const accountName = accountInfo?.name || accountInfo?.email || accountEmail;
      
      console.log(`Processing ${type} account: ${accountEmail} (${emails.length} emails)`);
      
      try {
        if (type === 'smtp') {
          const { host, port, user, pass } = accountConfig;
          
          const transporter = nodemailer.createTransporter({
            host,
            port: parseInt(port),
            secure: parseInt(port) === 465,
            auth: { user, pass },
            tls: { rejectUnauthorized: false }
          });

          await transporter.verify();
          console.log(`SMTP verified for ${accountEmail}`);

          // Send emails
          for (let i = 0; i < emails.length; i++) {
            const emailData = emails[i];
            
            try {
              const { fromName, subject } = applyRotation(emailData, globalEmailIndex, rotation);

              const mailOptions = {
                from: `${fromName} <${emailData.fromEmail || accountEmail}>`,
                to: emailData.recipient,
                subject: subject,
                html: emailData.htmlContent || '',
                text: emailData.textContent || ''
              };

              await transporter.sendMail(mailOptions);
              totalSent++;
              
            } catch (error) {
              totalFailed++;
              console.error(`Failed to send to ${emailData.recipient}:`, error.message);
            }

            globalEmailIndex++;
            
            if (delayMs > 0 && i < emails.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }

          transporter.close();

        } else if (type === 'apps-script') {
          const scriptUrl = accountConfig.script_url || accountConfig.exec_url;

          if (!scriptUrl) {
            throw new Error(`Apps Script URL missing for ${accountEmail}`);
          }

          for (let i = 0; i < emails.length; i++) {
            const emailData = emails[i];
            
            try {
              const { fromName, subject } = applyRotation(emailData, globalEmailIndex, rotation);

              const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: emailData.recipient,
                  subject: subject,
                  htmlBody: emailData.htmlContent || '',
                  plainBody: emailData.textContent || '',
                  fromName: fromName,
                  fromAlias: emailData.fromEmail || accountEmail
                })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                  totalSent++;
                } else {
                  throw new Error(result.message || 'Apps Script error');
                }
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error) {
              totalFailed++;
              console.error(`Apps Script failed for ${emailData.recipient}:`, error.message);
            }

            globalEmailIndex++;
            
            if (delayMs > 0 && i < emails.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

      } catch (accountError) {
        console.error(`Account ${accountId} failed:`, accountError.message);
        totalFailed += emails.length;
        globalEmailIndex += emails.length;
      }
    }

    // Update campaign status
    const finalStatus = totalSent > 0 ? 'sent' : 'failed';
    const updateData = { 
      status: finalStatus,
      sent_count: totalSent,
      completed_at: new Date().toISOString()
    };

    if (totalFailed > 0) {
      updateData.error_message = `${totalFailed} emails failed out of ${totalSent + totalFailed} total`;
    } else {
      updateData.error_message = null;
    }

    await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', campaignId);

    console.log(`Campaign completed: ${totalSent} sent, ${totalFailed} failed`);

    res.set(corsHeaders);
    res.json({ 
      success: true,
      sentCount: totalSent,
      failedCount: totalFailed,
      campaignId
    });

  } catch (error) {
    console.error('Error:', error);
    
    if (req.body?.campaignId && req.body?.supabaseUrl && req.body?.supabaseKey) {
      try {
        const supabase = createClient(req.body.supabaseUrl, req.body.supabaseKey);
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', req.body.campaignId);
      } catch (revertError) {
        console.error('Failed to update status:', revertError);
      }
    }

    res.set(corsHeaders);
    res.status(500).json({ 
      success: false,
      error: error.message,
      campaignId: req.body?.campaignId || 'unknown'
    });
  }
});

// Start the server on the port specified by the PORT environment variable
const port = process.env.PORT || 8080;
functions.http('sendEmailCampaign').listen(port, () => {
  console.log(`Server starting on port ${port}`);
});
