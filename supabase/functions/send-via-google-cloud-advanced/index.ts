
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
    const { campaignId, resumeFromIndex = 0 } = await req.json()

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

    if (campaign.status !== 'prepared' && campaign.status !== 'paused') {
      return new Response(
        JSON.stringify({ error: 'Campaign must be prepared before sending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const preparedEmails = campaign.prepared_emails || []
    if (preparedEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No prepared emails found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get global Google Cloud Functions settings
    const globalSettings = {
      functionUrl: '',
      defaultRateLimit: 3600,
      defaultBatchSize: 10
    }

    // Try to get from campaign config or use defaults
    const gcfConfig = campaign.config?.googleCloud || globalSettings

    if (!gcfConfig.functionUrl) {
      return new Response(
        JSON.stringify({ error: 'Google Cloud Functions URL not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Get emails to send (from resumeFromIndex onwards)
    const emailsToSend = preparedEmails.slice(resumeFromIndex)
    
    // Group emails by account for parallel processing
    const emailsByAccount = new Map()
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id
      if (!emailsByAccount.has(accountId)) {
        emailsByAccount.set(accountId, [])
      }
      emailsByAccount.get(accountId).push({
        ...email,
        globalIndex: resumeFromIndex + index
      })
    })

    console.log(`Sending ${emailsToSend.length} emails using ${emailsByAccount.size} accounts in parallel`)

    // Send to Google Cloud Functions for parallel processing
    try {
      const response = await fetch(gcfConfig.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId,
          emailsByAccount: Object.fromEntries(emailsByAccount),
          totalEmails: emailsToSend.length,
          resumeFromIndex,
          supabaseUrl,
          supabaseKey
        })
      })

      if (!response.ok) {
        throw new Error(`Google Cloud Functions responded with status: ${response.status}`)
      }

      const result = await response.json()
      
      console.log('Google Cloud Functions result:', result)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Campaign sending initiated via Google Cloud Functions',
          details: result,
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('Error calling Google Cloud Functions:', error)
      
      // Revert status on error
      await supabase
        .from('email_campaigns')
        .update({ status: 'prepared' })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to initiate sending via Google Cloud Functions: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in advanced Google Cloud sender:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
