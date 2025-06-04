
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
  config?: any;
}

function generateRandomValue(type: string, length: number): string {
  const chars = {
    'n': '0123456789',
    'a': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    'l': 'abcdefghijklmnopqrstuvwxyz',
    'u': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    's': '*-_#!@$%&',
    'lu': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    'ln': 'abcdefghijklmnopqrstuvwxyz0123456789',
    'un': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  };
  
  const charset = chars[type] || chars['a'];
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

function processTags(content: string, recipient: any, account: EmailAccount, config: any, index: number): string {
  let processed = content;
  
  // Rotation logic
  if (config?.rotation?.useRotation) {
    const fromNames = config.rotation.fromNames || [];
    const subjects = config.rotation.subjects || [];
    
    if (fromNames.length > 0) {
      const fromName = fromNames[index % fromNames.length];
      processed = processed.replace(/\[from\]/g, fromName);
    }
    
    if (subjects.length > 0) {
      const subject = subjects[index % subjects.length];
      processed = processed.replace(/\[subject\]/g, subject);
    }
  } else {
    processed = processed.replace(/\[from\]/g, config.from_name || '');
    processed = processed.replace(/\[subject\]/g, config.subject || '');
  }
  
  // Basic tags
  processed = processed.replace(/\[to\]/g, recipient.email || recipient);
  
  // SMTP tags
  if (account.type === 'smtp') {
    processed = processed.replace(/\[smtp\]/g, account.config?.username || '');
    processed = processed.replace(/\[smtp_name\]/g, account.name || '');
  }
  
  // Random tags
  const randomTags = processed.match(/\[rnd[alnulslnun]+_(\d+)\]/g);
  if (randomTags) {
    randomTags.forEach(tag => {
      const match = tag.match(/\[rnd([alnulslnun]+)_(\d+)\]/);
      if (match) {
        const type = match[1];
        const length = parseInt(match[2]);
        const randomValue = generateRandomValue(type, length);
        processed = processed.replace(tag, randomValue);
      }
    });
  }
  
  return processed;
}

function addTrackingPixel(htmlContent: string, campaignId: string, recipientEmail: string): string {
  const trackingPixel = `<img src="${Deno.env.get('SUPABASE_URL')}/functions/v1/track-open?campaign=${campaignId}&email=${encodeURIComponent(recipientEmail)}" width="1" height="1" style="display:none;" />`;
  
  // Add tracking pixel before closing body tag, or at the end if no body tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  } else {
    return htmlContent + trackingPixel;
  }
}

function addClickTracking(htmlContent: string, campaignId: string, recipientEmail: string): string {
  const baseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/track-click`;
  
  // Replace all links with tracked links
  return htmlContent.replace(
    /<a\s+href="([^"]+)"([^>]*)>/gi,
    (match, url, attributes) => {
      const trackedUrl = `${baseUrl}?campaign=${campaignId}&email=${encodeURIComponent(recipientEmail)}&url=${encodeURIComponent(url)}`;
      return `<a href="${trackedUrl}"${attributes}>`;
    }
  );
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
      return { success: true, logs: result.logs };
    } else {
      return { success: false, error: result.error || 'SMTP sending failed', logs: result.logs };
    }
  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message, logs: [`Fatal error: ${error.message}`] };
  }
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

    // Get selected accounts from campaign config
    const selectedAccountIds = campaign.config?.selectedAccounts || [];
    
    const { data: accounts, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('id', selectedAccountIds)
      .eq('is_active', true)

    if (accountError) throw accountError
    if (!accounts || accounts.length === 0) {
      throw new Error('No active accounts found for this campaign')
    }

    // Parse recipients
    const recipientList = campaign.recipients.split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    console.log(`Sending campaign ${campaignId} to ${recipientList.length} recipients using ${accounts.length} accounts`)

    const results = [];
    let sentCount = 0;

    // Process each recipient
    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];
      
      // Select account based on sending method
      let selectedAccount;
      if (campaign.config?.sendingMethod === 'round-robin') {
        selectedAccount = accounts[i % accounts.length];
      } else {
        selectedAccount = accounts[0]; // Use first account
      }

      try {
        // Process content with tags and rotation
        let processedHtml = processTags(campaign.html_content || '', recipient, selectedAccount, campaign, i);
        let processedSubject = processTags(campaign.subject, recipient, selectedAccount, campaign, i);
        let processedText = processTags(campaign.text_content || '', recipient, selectedAccount, campaign, i);

        // Add tracking
        processedHtml = addTrackingPixel(processedHtml, campaignId, recipient);
        processedHtml = addClickTracking(processedHtml, campaignId, recipient);

        // Get from name with rotation
        let fromName = campaign.from_name;
        if (campaign.config?.rotation?.useRotation && campaign.config.rotation.fromNames?.length > 0) {
          fromName = campaign.config.rotation.fromNames[i % campaign.config.rotation.fromNames.length];
        }

        const emailData = {
          from: { email: selectedAccount.email, name: fromName },
          to: recipient,
          subject: processedSubject,
          html: processedHtml,
          text: processedText
        };

        // Send based on account type
        if (selectedAccount.type === 'smtp') {
          const result = await sendEmailViaSMTP(selectedAccount.config, emailData);
          
          if (result.success) {
            console.log(`✓ SMTP sent to: ${recipient}`);
            results.push({ email: recipient, status: 'sent', account: selectedAccount.name });
            sentCount++;
          } else {
            console.log(`✗ SMTP failed to: ${recipient} - ${result.error}`);
            results.push({ email: recipient, status: 'failed', error: result.error, account: selectedAccount.name });
          }
        } else {
          // Handle other account types (apps-script, powermta) here
          console.log(`✗ Account type ${selectedAccount.type} not yet implemented`);
          results.push({ email: recipient, status: 'failed', error: 'Account type not implemented', account: selectedAccount.name });
        }

      } catch (error) {
        console.log(`✗ Error for ${recipient}:`, error);
        results.push({ email: recipient, status: 'failed', error: error.message });
      }
      
      // Add delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update campaign status
    const finalStatus = sentCount === recipientList.length ? 'sent' : 
                       sentCount > 0 ? 'sent' : 'failed';

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: finalStatus,
        sent_count: sentCount,
        total_recipients: recipientList.length,
        sent_at: new Date().toISOString()
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
        bounces: recipientList.length - sentCount,
        unsubscribes: 0,
        delivered: sentCount
      })

    if (statsError) console.error('Error creating stats:', statsError)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        failedCount: recipientList.length - sentCount,
        totalRecipients: recipientList.length,
        accountsUsed: accounts.length,
        trackingEnabled: true,
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
