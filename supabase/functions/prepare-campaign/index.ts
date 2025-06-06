
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
    const fromNames = config.rotation.fromNames?.filter(n => n.trim()) || [];
    const subjects = config.rotation.subjects?.filter(s => s.trim()) || [];
    
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
  
  // Random tags with all variations
  const randomTagPatterns = [
    { pattern: /\[rndn_(\d+)\]/g, type: 'n' },
    { pattern: /\[rnda_(\d+)\]/g, type: 'a' },
    { pattern: /\[rndl_(\d+)\]/g, type: 'l' },
    { pattern: /\[rndu_(\d+)\]/g, type: 'u' },
    { pattern: /\[rnds_(\d+)\]/g, type: 's' },
    { pattern: /\[rndlu_(\d+)\]/g, type: 'lu' },
    { pattern: /\[rndln_(\d+)\]/g, type: 'ln' },
    { pattern: /\[rndun_(\d+)\]/g, type: 'un' }
  ];

  randomTagPatterns.forEach(({ pattern, type }) => {
    processed = processed.replace(pattern, (match, length) => {
      return generateRandomValue(type, parseInt(length));
    });
  });
  
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

    console.log(`Preparing campaign ${campaignId} for ${recipientList.length} recipients using ${accounts.length} accounts`)

    const preparedEmails = [];

    // Prepare each email
    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];
      
      // Select account based on sending method
      let selectedAccount;
      if (campaign.config?.sendingMethod === 'round-robin') {
        selectedAccount = accounts[i % accounts.length];
      } else {
        selectedAccount = accounts[0]; // Use first account
      }

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
        const validFromNames = campaign.config.rotation.fromNames.filter(n => n.trim());
        if (validFromNames.length > 0) {
          fromName = validFromNames[i % validFromNames.length];
        }
      }

      const preparedEmail = {
        recipient,
        accountId: selectedAccount.id,
        accountType: selectedAccount.type,
        accountConfig: selectedAccount.config,
        fromEmail: selectedAccount.email,
        fromName,
        subject: processedSubject,
        htmlContent: processedHtml,
        textContent: processedText,
        status: 'prepared',
        index: i
      };

      preparedEmails.push(preparedEmail);
    }

    // Update campaign with prepared emails and new status
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        prepared_emails: preparedEmails
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    console.log(`✓ Campaign ${campaignId} prepared successfully with ${preparedEmails.length} emails`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        preparedCount: preparedEmails.length,
        totalRecipients: recipientList.length,
        accountsUsed: accounts.length,
        status: 'prepared'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error preparing campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
