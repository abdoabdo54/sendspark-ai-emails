
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
    
    // Group emails by account for immediate parallel processing
    const emailsByAccount = new Map()
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id
      if (!emailsByAccount.has(accountId)) {
        const accountConfig = email.accountConfig || {}
        
        // IMMEDIATE PROCESSING - No delays, maximum speed
        let rateLimit = 10; // 10 emails per second - FAST
        let batchSize = 50;  // Large batches for speed
        
        if (email.accountType === 'smtp') {
          rateLimit = 10; // 10 emails per second
          batchSize = 50; // Process 50 emails at once
        } else if (email.accountType === 'apps-script') {
          rateLimit = 5; // 5 emails per second for Apps Script
          batchSize = 20; // Smaller batches for Apps Script
        }

        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: {
            ...accountConfig,
            // IMMEDIATE PROCESSING CONFIGURATION
            rateLimit: rateLimit,
            batchSize: batchSize,
            maxRetries: 2, // Fewer retries for speed
            retryDelay: 1000, // 1 second between retries
            connectionTimeout: 10000, // 10 seconds timeout
            immediateStart: true, // Start immediately
            noDelay: true, // No artificial delays
          },
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

    console.log(`IMMEDIATE SENDING: ${emailsToSend.length} emails using ${emailsByAccount.size} accounts`)

    // IMMEDIATE PROCESSING payload - optimized for speed
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: emailsToSend.length,
      resumeFromIndex,
      supabaseUrl,
      supabaseKey,
      // IMMEDIATE PROCESSING CONFIGURATION
      config: {
        // SPEED OPTIMIZED SETTINGS
        immediateStart: true,
        noDelays: true,
        maxSpeed: true,
        
        // Rate limiting - but fast
        enforceRateLimit: true,
        respectAccountLimits: false, // Ignore limits for testing
        enableBatchProcessing: true,
        
        // Progress tracking
        updateProgressInRealTime: true,
        progressUpdateInterval: 5, // Update every 5 emails
        
        // Error handling - minimal for speed
        enableRetryLogic: true,
        maxGlobalRetries: 2,
        resumeOnFailure: true,
        failureRecoveryMode: 'fast',
        
        // Performance optimization - MAXIMUM SPEED
        parallelAccountProcessing: true,
        connectionPooling: true,
        keepAliveConnections: true,
        maxConcurrentConnections: 20,
        
        // Monitoring and logging - minimal
        enableDetailedLogging: false,
        logLevel: 'error',
        trackDeliveryStatus: true,
        
        // Campaign management
        autoCompleteOnFinish: true,
        updateCampaignStatus: true,
        preserveEmailOrder: false,
        
        // Timeout configuration - AGGRESSIVE
        globalTimeout: 300000, // 5 minutes maximum
        emailTimeout: 5000,    // 5 seconds per email
        batchTimeout: 60000,   // 1 minute per batch
      }
    };

    console.log('IMMEDIATE SENDING - Enhanced payload for MAXIMUM SPEED:')
    console.log('- Number of accounts:', emailsByAccount.size)
    console.log('- Total emails to send:', emailsToSend.length)
    console.log('- Resume from index:', resumeFromIndex)
    console.log('- Function URL:', gcfConfig.functionUrl)
    console.log('- IMMEDIATE START MODE ENABLED')
    console.log('- NO DELAYS - MAXIMUM SPEED')

    // Send to Google Cloud Functions with IMMEDIATE processing
    let response;
    let attempt = 0;
    const maxAttempts = 2; // Reduced for speed
    const baseDelay = 500; // Reduced delay
    
    while (attempt < maxAttempts) {
      try {
        console.log(`IMMEDIATE ATTEMPT ${attempt + 1} to call Google Cloud Function`)
        
        // Faster timeout for immediate processing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        response = await fetch(gcfConfig.functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Supabase-Edge-Function-Immediate/1.0',
            'X-Campaign-ID': campaignId,
            'X-Email-Count': emailsToSend.length.toString(),
            'X-Account-Count': emailsByAccount.size.toString(),
            'X-Immediate-Mode': 'true',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })

        clearTimeout(timeoutId);
        console.log(`Google Cloud Functions response status: ${response.status}`);

        if (response.ok) {
          break; // Success, exit retry loop
        } else {
          const errorText = await response.text();
          console.error(`Google Cloud Functions error (attempt ${attempt + 1}): ${response.status} - ${errorText}`);
          
          if (attempt === maxAttempts - 1) {
            // Last attempt failed, revert status
            await supabase
              .from('email_campaigns')
              .update({ 
                status: 'prepared',
                error_message: `Google Cloud Function failed: ${response.status} - ${errorText}`
              })
              .eq('id', campaignId)
            
            throw new Error(`Google Cloud Functions failed after ${maxAttempts} attempts: ${response.status} - ${errorText}`)
          }
        }
      } catch (error) {
        console.error(`Network error on attempt ${attempt + 1}:`, error);
        
        if (attempt === maxAttempts - 1) {
          // Last attempt failed, revert status
          await supabase
            .from('email_campaigns')
            .update({ 
              status: 'prepared',
              error_message: `Network error: ${error.message}`
            })
            .eq('id', campaignId)
          
          throw error;
        }
      }
      
      attempt++;
      // Minimal delay for immediate processing
      const delay = baseDelay * Math.pow(1.5, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await response.json()
    console.log('Google Cloud Functions IMMEDIATE result:', JSON.stringify(result, null, 2))

    // Enhanced status checking for immediate completion
    if (result.completed || result.status === 'completed') {
      console.log('Campaign completed immediately, updating status')
      await supabase
        .from('email_campaigns')
        .update({ 
          status: result.success ? 'sent' : 'failed',
          sent_count: result.sentCount || result.sent_count || 0,
          completed_at: new Date().toISOString(),
          error_message: result.error || null
        })
        .eq('id', campaignId)
    } else if (result.error) {
      console.error('Google Cloud Function reported error:', result.error)
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: result.error
        })
        .eq('id', campaignId)
    } else if (result.processing || result.status === 'processing') {
      console.log('Campaign is being processed IMMEDIATELY')
      // Status remains 'sending' - the GCF will update it when complete
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'IMMEDIATE CAMPAIGN SENDING initiated via Google Cloud Functions',
        details: result,
        configuration: {
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          immediate_mode: true,
          max_speed_enabled: true,
          no_delays: true,
          fast_processing: true
        },
        gcf_url: gcfConfig.functionUrl,
        immediate_completion: result.completed || result.status === 'completed',
        retry_attempts: attempt + 1,
        processing_mode: 'IMMEDIATE_MAXIMUM_SPEED'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in IMMEDIATE Google Cloud sender:', error)
    
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
            error_message: `IMMEDIATE sender error: ${error.message}`
          })
          .eq('id', campaignId)
      }
    } catch (revertError) {
      console.error('Failed to revert campaign status:', revertError)
    }
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to initiate IMMEDIATE sending via Google Cloud Functions: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
