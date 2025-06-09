
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse recipients
    const recipients = campaign.recipients.split(',').map(email => email.trim()).filter(email => email)

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare emails with tracking
    const baseUrl = supabaseUrl.replace('.supabase.co', '.supabase.co/functions/v1')
    
    const preparedEmails = recipients.map(email => {
      let htmlContent = campaign.html_content || ''
      let textContent = campaign.text_content || ''

      // Add tracking pixel to HTML content
      const trackingPixel = `<img src="${baseUrl}/track-open?campaign=${campaignId}&email=${encodeURIComponent(email)}" width="1" height="1" style="display:none;" alt="" />`
      
      if (htmlContent) {
        // Add tracking pixel before closing body tag, or at the end if no body tag
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${trackingPixel}</body>`)
        } else {
          htmlContent += trackingPixel
        }

        // Replace links with tracking links
        htmlContent = htmlContent.replace(
          /href="([^"]+)"/g,
          (match, url) => {
            if (url.startsWith('mailto:') || url.startsWith('#')) {
              return match // Don't track mailto or anchor links
            }
            const trackingUrl = `${baseUrl}/track-click?campaign=${campaignId}&email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}`
            return `href="${trackingUrl}"`
          }
        )
      }

      // Add unsubscribe link
      const unsubscribeUrl = `${baseUrl}/track-unsubscribe?campaign=${campaignId}&email=${encodeURIComponent(email)}`
      const unsubscribeText = `\n\nTo unsubscribe from future emails, click here: ${unsubscribeUrl}`
      const unsubscribeHtml = `<br><br><small><a href="${unsubscribeUrl}">Unsubscribe from future emails</a></small>`

      if (textContent) {
        textContent += unsubscribeText
      }
      if (htmlContent) {
        htmlContent += unsubscribeHtml
      }

      return {
        to: email,
        subject: campaign.subject,
        from_name: campaign.from_name,
        html_content: htmlContent,
        text_content: textContent,
        send_method: campaign.send_method
      }
    })

    // Update campaign with prepared emails
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        prepared_emails: preparedEmails,
        status: 'prepared',
        total_recipients: recipients.length
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update campaign' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        prepared_count: preparedEmails.length,
        message: `Campaign prepared with ${preparedEmails.length} emails ready to send`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in prepare-campaign:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
