
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
    
    // Group emails by account for processing
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

    console.log(`Sending ${emailsToSend.length} emails using ${emailsByAccount.size} accounts`)

    // Prepare payload for Google Cloud Function (matching the expected format)
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: emailsToSend.length,
      resumeFromIndex,
      supabaseUrl,
      supabaseKey,
      config: {
        immediateStart: true,
        maxSpeed: true,
        parallelAccountProcessing: true,
        updateProgressInRealTime: true
      }
    };

    console.log('Sending payload to Google Cloud Function:')
    console.log('- Campaign ID:', campaignId)
    console.log('- Number of accounts:', emailsByAccount.size)
    console.log('- Total emails to send:', emailsToSend.length)
    console.log('- Resume from index:', resumeFromIndex)
    console.log('- Function URL:', gcfConfig.functionUrl)

    // Send to Google Cloud Functions
    let response;
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`Attempt ${attempt + 1} to call Google Cloud Function`)
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        response = await fetch(gcfConfig.functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Supabase-Edge-Function/1.0',
            'X-Campaign-ID': campaignId,
            'X-Email-Count': emailsToSend.length.toString(),
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
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }

    const result = await response.json()
    console.log('Google Cloud Functions result:', JSON.stringify(result, null, 2))

    // Check if the campaign completed successfully
    if (result.success && result.completed) {
      console.log('Campaign completed successfully')
      await supabase
        .from('email_campaigns')
        .update({ 
          status: result.sentCount > 0 ? 'sent' : 'failed',
          sent_count: result.sentCount || 0,
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
    } else if (result.success && !result.completed) {
      console.log('Campaign is being processed')
      // The Google Cloud Function is handling the sending
      // Status will be updated by the function itself
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign sending initiated via Google Cloud Functions',
        details: result,
        configuration: {
          accounts_processing: emailsByAccount.size,
          total_emails: emailsToSend.length,
          immediate_mode: true
        },
        gcf_url: gcfConfig.functionUrl,
        completed: result.completed || false,
        retry_attempts: attempt + 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in Google Cloud sender:', error)
    
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
        error: `Failed to send via Google Cloud Functions: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
