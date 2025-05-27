import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailAccount {
  id: string;
  name: string;
  type: string;
  email: string;
  config: any;
}

interface Campaign {
  id: string;
  from_name: string;
  subject: string;
  recipients: string;
  html_content?: string;
  text_content?: string;
  send_method: string;
}

async function sendEmailViaSMTP(config: any, emailData: any): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log(`Sending email via SMTP to ${emailData.to}`);
    
    const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/send-smtp-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        config,
        emailData
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      if (result.logs) {
        console.log('SMTP Success Logs:', result.logs.join('\n'));
      }
      return { success: true, logs: result.logs };
    } else {
      if (result.logs) {
        console.error('SMTP Error Logs:', result.logs.join('\n'));
      }
      return { success: false, error: result.error || 'SMTP sending failed', logs: result.logs };
    }
  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message, logs: [`Fatal error: ${error.message}`] };
  }
}

async function sendViaSMTP(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via SMTP: ${account.config.host}:${account.config.port}`);
  
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const emailData = {
        from: { email: account.email, name: campaign.from_name },
        to: recipient,
        subject: campaign.subject,
        html: campaign.html_content || campaign.text_content,
        text: campaign.text_content
      };

      const result = await sendEmailViaSMTP(account.config, emailData);

      if (result.success) {
        console.log(`✓ SMTP sent to: ${recipient}`);
        results.push({ email: recipient, status: 'sent', logs: result.logs });
      } else {
        console.log(`✗ SMTP failed to: ${recipient} - ${result.error}`);
        if (result.logs) {
          console.log(`SMTP Logs for ${recipient}:`, result.logs.join('\n'));
        }
        results.push({ email: recipient, status: 'failed', error: result.error, logs: result.logs });
      }
    } catch (error) {
      console.log(`✗ SMTP error for ${recipient}:`, error);
      results.push({ email: recipient, status: 'failed', error: error.message });
    }
    
    // Add delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

async function sendViaAppsScript(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via Google Apps Script: ${account.config.script_id}`);
  
  const results = [];
  
  try {
    const response = await fetch(`https://script.google.com/macros/s/${account.config.deployment_id}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${account.config.api_key}`
      },
      body: JSON.stringify({
        recipients: recipients,
        subject: campaign.subject,
        htmlContent: campaign.html_content,
        textContent: campaign.text_content,
        fromName: campaign.from_name,
        fromEmail: account.email
      })
    });

    if (response.ok) {
      const result = await response.json();
      for (const recipient of recipients) {
        console.log(`✓ Apps Script sent to: ${recipient}`);
        results.push({ email: recipient, status: 'sent' });
      }
    } else {
      for (const recipient of recipients) {
        console.log(`✗ Apps Script failed to: ${recipient}`);
        results.push({ email: recipient, status: 'failed', error: 'Apps Script API error' });
      }
    }
  } catch (error) {
    console.log(`✗ Apps Script error:`, error);
    for (const recipient of recipients) {
      results.push({ email: recipient, status: 'failed', error: error.message });
    }
  }
  
  return results;
}

async function sendViaPowerMTA(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via PowerMTA: ${account.config.server_host}`);
  
  const results = [];
  
  try {
    const response = await fetch(`http://${account.config.server_host}:${account.config.api_port}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${account.config.username}:${account.config.password}`)}`
      },
      body: JSON.stringify({
        recipients: recipients,
        subject: campaign.subject,
        html_content: campaign.html_content,
        text_content: campaign.text_content,
        from_name: campaign.from_name,
        from_email: account.email,
        virtual_mta: account.config.virtual_mta,
        job_pool: account.config.job_pool
      })
    });

    if (response.ok) {
      for (const recipient of recipients) {
        console.log(`✓ PowerMTA sent to: ${recipient}`);
        results.push({ email: recipient, status: 'sent' });
      }
    } else {
      for (const recipient of recipients) {
        console.log(`✗ PowerMTA failed to: ${recipient}`);
        results.push({ email: recipient, status: 'failed', error: 'PowerMTA API error' });
      }
    }
  } catch (error) {
    console.log(`✗ PowerMTA error:`, error);
    for (const recipient of recipients) {
      results.push({ email: recipient, status: 'failed', error: error.message });
    }
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId } = await req.json()

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) throw campaignError

    // Get active email account for the send method
    const { data: accounts, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('type', campaign.send_method)
      .eq('is_active', true)
      .limit(1)

    if (accountError) throw accountError
    if (!accounts || accounts.length === 0) {
      throw new Error(`No active ${campaign.send_method} account found`)
    }

    const account = accounts[0]

    // Parse recipients
    const recipients = campaign.recipients.split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    console.log(`Sending campaign ${campaignId} to ${recipients.length} recipients using ${campaign.send_method}`)

    let results = [];

    // Route to appropriate sending method
    switch (campaign.send_method) {
      case 'smtp':
        results = await sendViaSMTP(account, campaign, recipients);
        break;
      case 'apps-script':
        results = await sendViaAppsScript(account, campaign, recipients);
        break;
      case 'powermta':
        results = await sendViaPowerMTA(account, campaign, recipients);
        break;
      default:
        throw new Error(`Unsupported send method: ${campaign.send_method}`);
    }

    // Count successful sends
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.length - sentCount;

    console.log(`Campaign ${campaignId} results: ${sentCount} sent, ${failedCount} failed`);

    // Update campaign status
    const finalStatus = sentCount === recipients.length ? 'sent' : 
                       sentCount > 0 ? 'sent' : 'failed';

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: finalStatus,
        sent_count: sentCount
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    // Create campaign stats
    const { error: statsError } = await supabase
      .from('campaign_stats')
      .insert({
        campaign_id: campaignId,
        opens: 0,
        clicks: 0,
        bounces: failedCount,
        unsubscribes: 0
      })

    if (statsError) console.error('Error creating stats:', statsError)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
        method: campaign.send_method,
        account: account.name,
        details: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error sending campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
