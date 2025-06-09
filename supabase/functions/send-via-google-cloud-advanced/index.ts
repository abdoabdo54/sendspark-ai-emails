
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

    console.log(`🚀 MAXIMUM SPEED PROCESSING for campaign ${campaignId}`)

    // Get campaign details with error handling
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError)
      
      // Try to update campaign status to failed
      if (campaignId) {
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Campaign not found: ${campaignError?.message || 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId)
      }
      
      return new Response(
        JSON.stringify({ error: 'Campaign not found', details: campaignError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enhanced status validation
    if (!['prepared', 'paused', 'sending'].includes(campaign.status)) {
      console.error('Invalid campaign status for sending:', campaign.status)
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Invalid status for sending: ${campaign.status}. Campaign must be prepared first.`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ 
          error: `Campaign status '${campaign.status}' is invalid for sending. Please prepare the campaign first.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const preparedEmails = campaign.prepared_emails || []
    if (preparedEmails.length === 0) {
      console.error('No prepared emails found')
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'No prepared emails found. Please prepare the campaign first.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
      
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
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'Google Cloud Functions not configured. Please prepare the campaign with Google Cloud Functions enabled.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ 
          error: 'Google Cloud Functions not configured. Please prepare the campaign again with Google Cloud Functions enabled.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`⚡ MAXIMUM SPEED: ${gcfConfig.functionUrl}`)

    // Ensure campaign is marked as sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', campaignId)

    // Get emails to send (from resumeFromIndex onwards)
    const emailsToSend = preparedEmails.slice(resumeFromIndex)
    console.log(`⚡ SENDING ${emailsToSend.length} emails at MAXIMUM SPEED starting from index ${resumeFromIndex}`)
    
    // Group emails by account for ultra-optimized processing
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

    console.log(`⚡ ULTRA-OPTIMIZED: ${emailsToSend.length} emails using ${emailsByAccount.size} accounts`)

    // Prepare MAXIMUM SPEED payload for Google Cloud Function
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: emailsToSend.length,
      resumeFromIndex,
      supabaseUrl,
      supabaseKey,
      config: {
        highSpeed: true,
        maxSpeed: true,
        parallelProcessing: true,
        optimizedBatching: true,
        maxConcurrency: true,
        ultraFast: true
      }
    };

    console.log(`🎯 MAXIMUM SPEED payload: ${emailsByAccount.size} accounts, ${emailsToSend.length} emails`)

    // Send to Google Cloud Functions with MAXIMUM SPEED settings
    const response = await fetch(gcfConfig.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-MaxSpeed/3.0',
        'X-Campaign-ID': campaignId,
        'X-Email-Count': emailsToSend.length.toString(),
        'X-Max-Speed': 'true',
        'X-Ultra-Fast': 'true'
      },
      body: JSON.stringify(payload)
    })

    console.log(`⚡ Google Cloud MAXIMUM SPEED response: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`💥 Google Cloud CRITICAL ERROR: ${response.status} - ${errorText}`)
      
      // Update campaign with error
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Google Cloud error: ${response.status} - ${errorText}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
      
      throw new Error(`Google Cloud Functions failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ MAXIMUM SPEED Google Cloud response:', JSON.stringify(result, null, 2))

    // Handle response based on completion status
    if (result.success && result.completed) {
      console.log('🎉 MAXIMUM SPEED Campaign completed successfully!')
      
      // Final status update
      await supabase
        .from('email_campaigns')
        .update({ 
          status: result.sentCount > 0 ? 'sent' : 'failed',
          sent_count: result.sentCount || 0,
          completed_at: new Date().toISOString(),
          error_message: result.failedCount > 0 ? `${result.failedCount} emails failed` : null
        })
        .eq('id', campaignId)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'MAXIMUM SPEED campaign processing via Google Cloud Functions',
        details: result,
        configuration: {
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          max_speed_mode: true,
          ultra_fast_processing: true,
          parallel_processing: true
        },
        gcf_url: gcfConfig.functionUrl,
        completed: result.completed || false,
        performance: { ...result.performance, maxSpeed: true, ultraFast: true }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 CRITICAL MAXIMUM SPEED ERROR:', error)
    
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
            status: 'failed',
            error_message: `Maximum speed sender error: ${error.message}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId)
      }
    } catch (revertError) {
      console.error('Failed to revert campaign status:', revertError)
    }
    
    return new Response(
      JSON.stringify({ 
        error: `MAXIMUM SPEED Google Cloud Functions failed: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
