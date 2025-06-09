
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailAccount {
  id: string;
  name: string;
  type: 'smtp' | 'apps-script' | 'powermta';
  email: string;
  config: {
    emails_per_second?: number;
    emails_per_hour?: number;
    rotation_enabled?: boolean;
    from_names?: string[];
    subjects?: string[];
    [key: string]: any;
  };
}

interface PreparedEmail {
  id: string;
  recipient: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_content: string;
  text_content: string;
  account_id: string;
  account_type: string;
  account_config: any;
  send_order: number;
  rotation_index: number;
  estimated_send_time: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId } = await req.json()

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get selected accounts from campaign config
    const selectedAccountIds = campaign.config?.selectedAccounts || []
    if (selectedAccountIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No accounts selected for this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get selected email accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('id', selectedAccountIds)
      .eq('is_active', true)

    if (accountsError || !accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active email accounts found for this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse recipients
    const recipients = campaign.recipients.split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Preparing campaign ${campaignId} with ${recipients.length} recipients using ${accounts.length} accounts`)

    // Prepare emails with advanced rotation and distribution
    const preparedEmails: PreparedEmail[] = []
    let currentTime = new Date()
    let globalOrderIndex = 0

    // Calculate total emails per second across all accounts (respecting hour limits)
    const totalEmailsPerSecond = accounts.reduce((total, account) => {
      const perSecond = account.config?.emails_per_second || 1
      const perHour = account.config?.emails_per_hour || 3600
      // Don't exceed hourly rate when calculated per second
      const maxPerSecondFromHourly = perHour / 3600
      const effectivePerSecond = Math.min(perSecond, maxPerSecondFromHourly)
      return total + effectivePerSecond
    }, 0)

    console.log(`Total sending capacity: ${totalEmailsPerSecond} emails/second`)

    // Get rotation settings from campaign config
    const rotationConfig = campaign.config?.rotation || {}
    const campaignFromNames = rotationConfig.fromNames || []
    const campaignSubjects = rotationConfig.subjects || []

    // Distribute recipients across accounts in round-robin fashion
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const accountIndex = i % accounts.length
      const account = accounts[accountIndex] as EmailAccount

      // Handle FROM name rotation (campaign level takes precedence)
      let fromName = campaign.from_name
      if (rotationConfig.useFromNameRotation && campaignFromNames.length > 0) {
        const rotationIndex = Math.floor(i / accounts.length) % campaignFromNames.length
        fromName = campaignFromNames[rotationIndex] || campaign.from_name
      } else if (account.config?.rotation_enabled && account.config?.from_names?.length > 0) {
        const rotationIndex = Math.floor(i / accounts.length) % account.config.from_names.length
        fromName = account.config.from_names[rotationIndex] || campaign.from_name
      }

      // Handle subject rotation (campaign level takes precedence)
      let subject = campaign.subject
      if (rotationConfig.useSubjectRotation && campaignSubjects.length > 0) {
        const rotationIndex = Math.floor(i / accounts.length) % campaignSubjects.length
        subject = campaignSubjects[rotationIndex] || campaign.subject
      } else if (account.config?.rotation_enabled && account.config?.subjects?.length > 0) {
        const rotationIndex = Math.floor(i / accounts.length) % account.config.subjects.length
        subject = account.config.subjects[rotationIndex] || campaign.subject
      }

      // Calculate delay based on total capacity
      const delaySeconds = Math.floor(globalOrderIndex / totalEmailsPerSecond)
      const estimatedSendTime = new Date(currentTime.getTime() + (delaySeconds * 1000))

      // Add tracking and unsubscribe links
      let htmlContent = campaign.html_content || ''
      let textContent = campaign.text_content || ''

      // Tracking pixel
      const baseUrl = supabaseUrl.replace('.supabase.co', '.supabase.co/functions/v1')
      const trackingPixel = `<img src="${baseUrl}/track-open?campaign=${campaignId}&email=${encodeURIComponent(recipient)}" width="1" height="1" style="display:none;" alt="" />`
      
      if (htmlContent) {
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`)
        } else {
          htmlContent += trackingPixel
        }

        // Replace links with tracking
        htmlContent = htmlContent.replace(
          /href="([^"]+)"/g,
          (match, url) => {
            if (url.startsWith('mailto:') || url.startsWith('#')) {
              return match
            }
            const trackingUrl = `${baseUrl}/track-click?campaign=${campaignId}&email=${encodeURIComponent(recipient)}&url=${encodeURIComponent(url)}`
            return `href="${trackingUrl}"`
          }
        )
      }

      // Add unsubscribe link
      const unsubscribeUrl = `${baseUrl}/track-unsubscribe?campaign=${campaignId}&email=${encodeURIComponent(recipient)}`
      const unsubscribeText = `\n\nUnsubscribe: ${unsubscribeUrl}`
      const unsubscribeHtml = `<br><br><small><a href="${unsubscribeUrl}">Unsubscribe</a></small>`

      if (textContent) textContent += unsubscribeText
      if (htmlContent) htmlContent += unsubscribeHtml

      const preparedEmail: PreparedEmail = {
        id: `${campaignId}_${globalOrderIndex}`,
        recipient,
        subject,
        from_name: fromName,
        from_email: account.email,
        html_content: htmlContent,
        text_content: textContent,
        account_id: account.id,
        account_type: account.type,
        account_config: account.config,
        send_order: globalOrderIndex,
        rotation_index: Math.floor(i / accounts.length),
        estimated_send_time: estimatedSendTime.toISOString()
      }

      preparedEmails.push(preparedEmail)
      globalOrderIndex++
    }

    // Sort by send order to ensure proper timing
    preparedEmails.sort((a, b) => a.send_order - b.send_order)

    // Update campaign with prepared emails and advanced metadata
    const preparationMetadata = {
      total_recipients: recipients.length,
      accounts_used: accounts.length,
      estimated_duration_seconds: Math.ceil(recipients.length / totalEmailsPerSecond),
      total_capacity_per_second: totalEmailsPerSecond,
      preparation_timestamp: new Date().toISOString(),
      rotation_settings: {
        campaign_from_names: campaignFromNames.length,
        campaign_subjects: campaignSubjects.length,
        using_campaign_rotation: rotationConfig.useFromNameRotation || rotationConfig.useSubjectRotation
      },
      account_distribution: accounts.map(account => ({
        account_id: account.id,
        account_name: account.name,
        account_type: account.type,
        emails_assigned: preparedEmails.filter(e => e.account_id === account.id).length,
        rate_limit_per_second: account.config?.emails_per_second || 1,
        rate_limit_per_hour: account.config?.emails_per_hour || 3600
      }))
    }

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        prepared_emails: preparedEmails,
        status: 'prepared',
        total_recipients: recipients.length,
        config: {
          ...(campaign.config || {}),
          preparation_metadata: preparationMetadata
        }
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update campaign' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        prepared_count: preparedEmails.length,
        accounts_used: accounts.length,
        estimated_duration_minutes: Math.ceil(preparationMetadata.estimated_duration_seconds / 60),
        total_capacity_per_second: totalEmailsPerSecond,
        message: `Campaign prepared with ${preparedEmails.length} emails across ${accounts.length} accounts`,
        metadata: preparationMetadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in advanced campaign preparation:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
