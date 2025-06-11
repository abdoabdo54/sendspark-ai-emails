
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

  const { campaignId, zeroDelay } = req.body || {};
  const skip = parseInt(req.query.skip || req.body.skip || '0');
  const limit = parseInt(req.query.limit || req.body.limit || '0');

  if (!campaignId) {
    res.status(400).json({ error: 'campaignId required' });
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (campaignError || !campaign) {
      res.status(400).json({ error: 'Campaign not found' });
      return;
    }

    const recipients = (campaign.recipients || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)
      .slice(skip, skip + limit);

    const { data: accounts, error: accError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('organization_id', campaign.organization_id)
      .eq('is_active', true);

    if (accError || !accounts || accounts.length === 0) {
      res.status(400).json({ error: 'No active sending accounts' });
      return;
    }

    const sendEmail = async (email, idx) => {
      const account = accounts[idx % accounts.length];
      const transporter = nodemailer.createTransporter({
        host: account.config.host,
        port: account.config.port,
        secure: account.config.secure,
        auth: {
          user: account.config.user || account.config.username,
          pass: account.config.pass || account.config.password
        }
      });
      const info = await transporter.sendMail({
        from: `${campaign.from_name} <${account.email}>`,
        to: email,
        subject: campaign.subject,
        html: campaign.html_content || '',
        text: campaign.text_content || ''
      });
      await supabase.from('email_logs').insert({
        campaign_id: campaign.id,
        recipient: email,
        account_id: account.id,
        message_id: info.messageId,
        status: 'sent'
      });
    };

    const sendPromises = recipients.map((email, idx) => sendEmail(email, idx));
    if (zeroDelay) {
      await Promise.all(sendPromises);
    } else {
      for (const p of sendPromises) {
        await p;
      }
    }

    await supabase
      .from('email_campaigns')
      .update({ sent_count: campaign.sent_count + recipients.length })
      .eq('id', campaign.id);

    res.json({ success: true, sent: recipients.length });
  } catch (err) {
    console.error('Send batch error:', err);
    res.status(500).json({ error: err.message });
  }
});
