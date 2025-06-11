
const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

functions.http('sendBatch', async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders).status(200).send('');
    return;
  }
  res.set(corsHeaders);

  const { 
    campaignId, 
    skip = 0, 
    limit = 0, 
    zeroDelay = false,
    useTestAfter = false,
    testAfterEmail = '',
    testAfterCount = 500,
    useTracking = false
  } = req.body || {};

  console.log(`📥 Received batch request: campaignId=${campaignId}, skip=${skip}, limit=${limit}, zeroDelay=${zeroDelay}`);

  if (!campaignId) {
    res.status(400).json({ error: 'campaignId required' });
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Fetch campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
      
    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      res.status(400).json({ error: 'Campaign not found' });
      return;
    }

    console.log(`📧 Campaign found: ${campaign.subject}`);

    // Parse and slice recipients
    const allRecipients = (campaign.recipients || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean);

    const recipients = allRecipients.slice(skip, skip + limit);
    
    console.log(`📋 Processing ${recipients.length} recipients (${skip} to ${skip + limit})`);

    if (recipients.length === 0) {
      res.json({ success: true, sent: 0, message: 'No recipients in this range' });
      return;
    }

    // Fetch active email accounts
    const { data: accounts, error: accError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('organization_id', campaign.organization_id)
      .eq('is_active', true);

    if (accError || !accounts || accounts.length === 0) {
      console.error('Accounts fetch error:', accError);
      res.status(400).json({ error: 'No active sending accounts' });
      return;
    }

    console.log(`👥 Found ${accounts.length} active accounts`);

    // Add tracking to HTML content if enabled
    let htmlContent = campaign.html_content || '';
    if (useTracking && htmlContent) {
      // Add tracking pixel
      const trackingPixel = `<img src="${process.env.SUPABASE_URL}/functions/v1/track-open?campaign={{campaign_id}}&email={{email}}" width="1" height="1" style="display:none;" />`;
      
      // Add click tracking to links
      htmlContent = htmlContent.replace(
        /<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi,
        `<a $1${process.env.SUPABASE_URL}/functions/v1/track-click?campaign={{campaign_id}}&email={{email}}&url=$2$3>`
      );
      
      // Add tracking pixel
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`);
      } else {
        htmlContent += trackingPixel;
      }
    }

    // Insert test-after emails if enabled
    let finalRecipients = [...recipients];
    if (useTestAfter && testAfterEmail) {
      const testEmails = [];
      for (let i = testAfterCount; i < finalRecipients.length; i += testAfterCount) {
        testEmails.push({ index: i, email: testAfterEmail });
      }
      
      // Insert test emails at specified intervals
      testEmails.reverse().forEach(({ index, email }) => {
        finalRecipients.splice(index, 0, email);
      });
      
      // Add test email at the end
      finalRecipients.push(testAfterEmail);
      
      console.log(`✅ Added ${testEmails.length + 1} test emails`);
    }

    // Send emails function
    const sendEmail = async (email, idx) => {
      const account = accounts[idx % accounts.length];
      
      try {
        const transporter = nodemailer.createTransporter({
          host: account.config.host,
          port: account.config.port,
          secure: account.config.secure || false,
          auth: {
            user: account.config.user || account.config.username,
            pass: account.config.pass || account.config.password
          },
          pool: zeroDelay, // Use connection pooling for zero delay mode
          maxConnections: zeroDelay ? 20 : 5,
          maxMessages: zeroDelay ? 100 : 10
        });

        // Replace placeholders in content
        const personalizedHtml = htmlContent
          .replace(/{{campaign_id}}/g, campaignId)
          .replace(/{{email}}/g, encodeURIComponent(email));
          
        const personalizedText = (campaign.text_content || '')
          .replace(/{{campaign_id}}/g, campaignId)
          .replace(/{{email}}/g, email);

        const info = await transporter.sendMail({
          from: `${campaign.from_name} <${account.email}>`,
          to: email,
          subject: campaign.subject,
          html: personalizedHtml,
          text: personalizedText
        });

        // Log successful send
        await supabase.from('email_logs').insert({
          campaign_id: campaignId,
          recipient: email,
          account_id: account.id,
          message_id: info.messageId,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        return { success: true, email, messageId: info.messageId };
      } catch (error) {
        console.error(`❌ Failed to send to ${email}:`, error.message);
        
        // Log failed send
        await supabase.from('email_logs').insert({
          campaign_id: campaignId,
          recipient: email,
          account_id: account.id,
          status: 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString()
        });

        return { success: false, email, error: error.message };
      }
    };

    console.log(`🚀 Starting email send (zeroDelay: ${zeroDelay})`);
    
    let results = [];
    const sendPromises = finalRecipients.map((email, idx) => sendEmail(email, idx));

    if (zeroDelay) {
      // Zero delay mode: send all emails in parallel
      console.log('⚡ Zero delay mode: sending all emails in parallel');
      results = await Promise.allSettled(sendPromises);
    } else {
      // Sequential sending with small delays
      console.log('🕐 Sequential mode: sending with delays');
      for (const promise of sendPromises) {
        const result = await promise;
        results.push({ status: 'fulfilled', value: result });
        
        // Small delay between sends in non-zero-delay mode
        if (!zeroDelay) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    // Count successful sends
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value?.success
    ).length;
    
    const failed = results.length - successful;

    console.log(`✅ Completed: ${successful} sent, ${failed} failed`);

    // Update campaign sent count
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({ 
        sent_count: campaign.sent_count + successful,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Error updating campaign count:', updateError);
    }

    res.json({ 
      success: true, 
      sent: successful,
      failed: failed,
      total: results.length,
      processed_range: `${skip}-${skip + limit}`,
      zero_delay_mode: zeroDelay
    });

  } catch (err) {
    console.error('💥 Send batch error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Check function logs for more information'
    });
  }
});
