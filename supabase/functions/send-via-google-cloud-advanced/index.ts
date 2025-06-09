
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

    console.log(`Processing campaign ${campaignId} from index ${resumeFromIndex}`)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (campaign.status !== 'prepared' && campaign.status !== 'paused' && campaign.status !== 'sending') {
      console.error('Invalid campaign status:', campaign.status)
      return new Response(
        JSON.stringify({ error: `Campaign must be prepared before sending. Current status: ${campaign.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const preparedEmails = campaign.prepared_emails || []
    if (preparedEmails.length === 0) {
      console.error('No prepared emails found')
      return new Response(
        JSON.stringify({ error: 'No prepared emails found. Please prepare the campaign first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google Cloud Functions configuration from campaign config
    let gcfConfig = null;
    
    if (campaign.config?.googleCloudFunctions) {
      gcfConfig = campaign.config.googleCloudFunctions;
    }
    
    if (!gcfConfig?.functionUrl) {
      console.error('No Google Cloud Functions URL found in campaign config')
      return new Response(
        JSON.stringify({ 
          error: 'Google Cloud Functions not configured for this campaign. Please prepare the campaign again with Google Cloud Functions enabled.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Using Google Cloud Function: ${gcfConfig.functionUrl}`);

    // Update campaign status to sending if not already
    if (campaign.status !== 'sending') {
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId)
    }

    // Get emails to send (from resumeFromIndex onwards)
    const emailsToSend = preparedEmails.slice(resumeFromIndex)
    console.log(`Sending ${emailsToSend.length} emails starting from index ${resumeFromIndex}`)
    
    // Group emails by account for parallel processing
    const emailsByAccount = new Map()
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id
      if (!emailsByAccount.has(accountId)) {
        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: email.accountConfig,
          emails: []
        })
      }
      emailsByAccount.get(accountId).emails.push({
        recipient: email.recipient,
        subject: email.subject,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
        globalIndex: resumeFromIndex + index
      })
    })

    console.log(`Sending ${emailsToSend.length} emails using ${emailsByAccount.size} accounts in parallel`)

    // Send to Google Cloud Functions for parallel processing
    try {
      const payload = {
        campaignId,
        emailsByAccount: Object.fromEntries(emailsByAccount),
        totalEmails: emailsToSend.length,
        resumeFromIndex,
        supabaseUrl,
        supabaseKey
      };

      console.log('Sending payload to Google Cloud Functions:', JSON.stringify(payload, null, 2));

      const response = await fetch(gcfConfig.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      console.log(`Google Cloud Functions response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Cloud Functions error: ${response.status} - ${errorText}`);
        
        // Revert status on error
        await supabase
          .from('email_campaigns')
          .update({ status: 'prepared' })
          .eq('id', campaignId)
        
        throw new Error(`Google Cloud Functions responded with status: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Google Cloud Functions result:', JSON.stringify(result, null, 2))

      // If Google Cloud Functions indicates immediate completion, update status
      if (result.completed) {
        console.log('Campaign completed immediately, updating status')
        await supabase
          .from('email_campaigns')
          .update({ 
            status: result.success ? 'sent' : 'failed',
            sent_count: result.sentCount || 0
          })
          .eq('id', campaignId)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Campaign sending initiated via Google Cloud Functions',
          details: result,
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          gcf_url: gcfConfig.functionUrl,
          immediate_completion: result.completed || false
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
          error: `Failed to initiate sending via Google Cloud Functions: ${error.message}`,
          gcf_url: gcfConfig.functionUrl 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in advanced Google Cloud sender:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
