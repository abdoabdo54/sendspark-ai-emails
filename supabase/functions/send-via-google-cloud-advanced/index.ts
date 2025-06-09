
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

    console.log(`🚀 INITIATING HIGH-SPEED PROCESSING for campaign ${campaignId}`)

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

    if (campaign.status !== 'prepared' && campaign.status !== 'paused') {
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

    // Get Google Cloud Functions configuration
    let gcfConfig = null;
    
    if (campaign.config?.googleCloudFunctions) {
      gcfConfig = campaign.config.googleCloudFunctions;
    }
    
    if (!gcfConfig?.functionUrl) {
      console.error('No Google Cloud Functions URL configured')
      return new Response(
        JSON.stringify({ 
          error: 'Google Cloud Functions not configured. Please prepare the campaign again with Google Cloud Functions enabled.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📡 Using Google Cloud Function: ${gcfConfig.functionUrl}`)

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
    console.log(`📧 Sending ${emailsToSend.length} emails starting from index ${resumeFromIndex}`)
    
    // Group emails by account for optimized processing
    const emailsByAccount = new Map()
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id
      if (!emailsByAccount.has(accountId)) {
        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: email.accountConfig || {},
          emails: [],
          accountInfo: {
            name: email.fromName || 'Unknown',
            email: email.fromEmail || 'unknown@domain.com'
          }
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

    console.log(`⚡ OPTIMIZED SENDING: ${emailsToSend.length} emails using ${emailsByAccount.size} accounts`)

    // Prepare optimized payload for Google Cloud Function
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: emailsToSend.length,
      resumeFromIndex,
      supabaseUrl,
      supabaseKey,
      config: {
        highSpeed: true,
        parallelProcessing: true,
        optimizedBatching: true,
        maxConcurrency: true
      }
    };

    console.log(`🎯 Payload prepared: ${emailsByAccount.size} accounts, ${emailsToSend.length} emails`)

    // Send to Google Cloud Functions with optimized settings
    const response = await fetch(gcfConfig.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-OptimizedSender/2.0',
        'X-Campaign-ID': campaignId,
        'X-Email-Count': emailsToSend.length.toString(),
        'X-High-Speed': 'true'
      },
      body: JSON.stringify(payload)
    })

    console.log(`📡 Google Cloud response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Google Cloud error: ${response.status} - ${errorText}`)
      
      // Revert status on error
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'prepared',
          error_message: `Google Cloud error: ${response.status} - ${errorText}`
        })
        .eq('id', campaignId)
      
      throw new Error(`Google Cloud Functions failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Google Cloud Functions response:', JSON.stringify(result, null, 2))

    // Handle response based on completion status
    if (result.success && result.completed) {
      console.log('🎉 Campaign completed successfully via Google Cloud')
      
      // Final status update will be handled by the Google Cloud Function
      // but we can do a safety update here
      await supabase
        .from('email_campaigns')
        .update({ 
          status: result.sentCount > 0 ? 'sent' : 'failed',
          sent_count: result.sentCount || 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'High-speed campaign processing initiated via Google Cloud Functions',
        details: result,
        configuration: {
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          high_speed_mode: true,
          parallel_processing: true
        },
        gcf_url: gcfConfig.functionUrl,
        completed: result.completed || false,
        performance: result.performance || { optimized: true }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Error in high-speed sender:', error)
    
    // Try to revert campaign status on any error
    try {
      const { campaignId } = await req.json()
      if (campaignId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'prepared',
            error_message: `Sender error: ${error.message}`
          })
          .eq('id', campaignId)
      }
    } catch (revertError) {
      console.error('Failed to revert campaign status:', revertError)
    }
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to send via optimized Google Cloud Functions: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
