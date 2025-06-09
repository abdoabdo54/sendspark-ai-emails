
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
    
    // Group emails by account for parallel processing with enhanced configuration
    const emailsByAccount = new Map()
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id
      if (!emailsByAccount.has(accountId)) {
        const accountConfig = email.accountConfig || {}
        
        // Enhanced rate limiting based on account type and configuration
        let rateLimit = 1; // Default: 1 email per second
        let batchSize = 1;  // Default: 1 email per batch
        
        if (email.accountType === 'smtp') {
          // SMTP accounts can handle higher rates
          rateLimit = accountConfig.emails_per_hour ? Math.floor(accountConfig.emails_per_hour / 3600) : 3;
          batchSize = Math.min(rateLimit * 10, 50); // 10 seconds worth of emails per batch, max 50
        } else if (email.accountType === 'apps-script') {
          // Apps Script has daily quotas, be more conservative
          const dailyQuota = accountConfig.daily_quota || 100;
          rateLimit = Math.max(1, Math.floor(dailyQuota / (24 * 3600))); // Spread throughout the day
          batchSize = Math.min(rateLimit * 60, 20); // 1 minute worth of emails per batch, max 20
        }

        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: {
            ...accountConfig,
            // Enhanced rate limiting configuration
            rateLimit: rateLimit,
            batchSize: batchSize,
            maxRetries: 3,
            retryDelay: 5000, // 5 seconds between retries
            connectionTimeout: 30000, // 30 seconds connection timeout
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

    console.log(`Sending ${emailsToSend.length} emails using ${emailsByAccount.size} accounts in parallel`)

    // Enhanced payload with comprehensive configuration
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: emailsToSend.length,
      resumeFromIndex,
      supabaseUrl,
      supabaseKey,
      // Enhanced configuration for Google Cloud Function
      config: {
        // Rate limiting and batch processing
        enforceRateLimit: true,
        respectAccountLimits: true,
        enableBatchProcessing: true,
        
        // Progress tracking
        updateProgressInRealTime: true,
        progressUpdateInterval: 10, // Update every 10 emails
        
        // Error handling and resilience
        enableRetryLogic: true,
        maxGlobalRetries: 3,
        resumeOnFailure: true,
        failureRecoveryMode: 'auto',
        
        // Performance optimization
        parallelAccountProcessing: true,
        connectionPooling: true,
        keepAliveConnections: true,
        
        // Monitoring and logging
        enableDetailedLogging: true,
        logLevel: 'info',
        trackDeliveryStatus: true,
        
        // Campaign management
        autoCompleteOnFinish: true,
        updateCampaignStatus: true,
        preserveEmailOrder: false, // Allow parallel sending for speed
        
        // Timeout configuration
        globalTimeout: 3600000, // 1 hour maximum execution time
        emailTimeout: 30000,    // 30 seconds per email
        batchTimeout: 300000,   // 5 minutes per batch
      }
    };

    console.log('Sending enhanced payload to Google Cloud Functions with advanced configuration:')
    console.log('- Number of accounts:', emailsByAccount.size)
    console.log('- Total emails to send:', emailsToSend.length)
    console.log('- Resume from index:', resumeFromIndex)
    console.log('- Function URL:', gcfConfig.functionUrl)
    console.log('- Enhanced rate limiting enabled')
    console.log('- Parallel processing enabled')
    console.log('- Auto-retry and recovery enabled')

    // Send to Google Cloud Functions with enhanced timeout and retry logic
    let response;
    let attempt = 0;
    const maxAttempts = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    while (attempt < maxAttempts) {
      try {
        console.log(`Attempt ${attempt + 1} to call Google Cloud Function`)
        
        // Enhanced fetch with longer timeout for large campaigns
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
        
        response = await fetch(gcfConfig.functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Supabase-Edge-Function/1.0',
            'X-Campaign-ID': campaignId,
            'X-Email-Count': emailsToSend.length.toString(),
            'X-Account-Count': emailsByAccount.size.toString(),
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
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await response.json()
    console.log('Google Cloud Functions result:', JSON.stringify(result, null, 2))

    // Enhanced status checking and immediate completion handling
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
      console.log('Campaign is being processed asynchronously')
      // Status remains 'sending' - the GCF will update it when complete
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign sending initiated via Google Cloud Functions with enhanced configuration',
        details: result,
        configuration: {
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          enhanced_rate_limiting: true,
          parallel_processing: true,
          auto_retry_enabled: true,
          progress_tracking: true
        },
        gcf_url: gcfConfig.functionUrl,
        immediate_completion: result.completed || result.status === 'completed',
        retry_attempts: attempt + 1,
        processing_mode: result.processing ? 'asynchronous' : 'synchronous'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in advanced Google Cloud sender:', error)
    
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
        error: `Failed to initiate sending via Google Cloud Functions: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
