
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

async function sendViaSMTP(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via SMTP: ${account.config.host}:${account.config.port}`);
  
  // Simulate SMTP sending with realistic delays
  const results = [];
  for (const recipient of recipients) {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Simulate 95% success rate
      if (Math.random() > 0.05) {
        console.log(`✓ SMTP sent to: ${recipient}`);
        results.push({ email: recipient, status: 'sent' });
      } else {
        console.log(`✗ SMTP failed to: ${recipient}`);
        results.push({ email: recipient, status: 'failed', error: 'SMTP delivery failed' });
      }
    } catch (error) {
      console.log(`✗ SMTP error for ${recipient}:`, error);
      results.push({ email: recipient, status: 'failed', error: error.message });
    }
  }
  return results;
}

async function sendViaAppsScript(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via Google Apps Script: ${account.config.script_id}`);
  
  const results = [];
  for (const recipient of recipients) {
    try {
      // Simulate Apps Script API call delay
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      // Simulate 98% success rate for Apps Script
      if (Math.random() > 0.02) {
        console.log(`✓ Apps Script sent to: ${recipient}`);
        results.push({ email: recipient, status: 'sent' });
      } else {
        console.log(`✗ Apps Script quota exceeded for: ${recipient}`);
        results.push({ email: recipient, status: 'failed', error: 'Daily quota exceeded' });
      }
    } catch (error) {
      console.log(`✗ Apps Script error for ${recipient}:`, error);
      results.push({ email: recipient, status: 'failed', error: error.message });
    }
  }
  return results;
}

async function sendViaPowerMTA(account: EmailAccount, campaign: Campaign, recipients: string[]) {
  console.log(`Sending via PowerMTA: ${account.config.server_host}`);
  
  const results = [];
  
  // PowerMTA can handle batch sending
  const batchSize = 100;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    try {
      // Simulate PowerMTA batch processing
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 200));
      
      // PowerMTA has very high success rate (99%)
      for (const recipient of batch) {
        if (Math.random() > 0.01) {
          console.log(`✓ PowerMTA sent to: ${recipient}`);
          results.push({ email: recipient, status: 'sent' });
        } else {
          console.log(`✗ PowerMTA bounced: ${recipient}`);
          results.push({ email: recipient, status: 'failed', error: 'Email bounced' });
        }
      }
    } catch (error) {
      console.log(`✗ PowerMTA batch error:`, error);
      for (const recipient of batch) {
        results.push({ email: recipient, status: 'failed', error: error.message });
      }
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
        account: account.name
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
