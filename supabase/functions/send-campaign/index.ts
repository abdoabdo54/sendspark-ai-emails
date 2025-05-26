
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

    // Parse recipients
    const recipients = campaign.recipients.split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    console.log(`Sending campaign ${campaignId} to ${recipients.length} recipients`)

    // Simulate email sending (replace with actual email service)
    let sentCount = 0
    for (const recipient of recipients) {
      try {
        // Simulate sending delay
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Here you would integrate with actual email services like:
        // - Google Apps Script
        // - PowerMTA
        // - SMTP services
        // - Resend/SendGrid/etc.
        
        console.log(`Sent email to: ${recipient}`)
        sentCount++
      } catch (error) {
        console.error(`Failed to send to ${recipient}:`, error)
      }
    }

    // Update campaign status
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: sentCount === recipients.length ? 'sent' : 'failed',
        sent_count: sentCount
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        totalRecipients: recipients.length 
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
