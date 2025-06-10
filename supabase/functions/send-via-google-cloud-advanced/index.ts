
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

  let requestBody: any = null;
  let campaignId: string | null = null;

  try {
    // Parse request body once and store it
    const bodyText = await req.text();
    console.log('Raw request body:', bodyText);
    
    if (!bodyText) {
      throw new Error('Empty request body');
    }

    try {
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    campaignId = requestBody.campaignId;
    const resumeFromIndex = requestBody.resumeFromIndex || 0;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🚀 MAXIMUM SPEED PROCESSING for campaign ${campaignId}`);

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    // Get campaign details with error handling
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      
      if (campaignId) {
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Campaign not found: ${campaignError?.message || 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Campaign not found', details: campaignError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhanced status validation
    if (!['prepared', 'paused', 'sending'].includes(campaign.status)) {
      console.error('Invalid campaign status for sending:', campaign.status);
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Invalid status for sending: ${campaign.status}. Campaign must be prepared first.`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ 
          error: `Campaign status '${campaign.status}' is invalid for sending. Please prepare the campaign first.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preparedEmails = campaign.prepared_emails || [];
    if (preparedEmails.length === 0) {
      console.error('No prepared emails found');
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'No prepared emails found. Please prepare the campaign first.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ error: 'No prepared emails found. Please prepare the campaign first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google Cloud Functions configuration - Check campaign config first
    let gcfConfig = null;
    
    // First check campaign config for Google Cloud Functions
    if (campaign.config?.googleCloudFunctions) {
      gcfConfig = campaign.config.googleCloudFunctions;
      console.log('Using campaign-level Google Cloud config');
    } else {
      console.log('No campaign-level Google Cloud config found, checking for global config');
    }
    
    if (!gcfConfig?.functionUrl) {
      console.error('No Google Cloud Functions URL configured');
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'Google Cloud Functions not configured. Please check your Google Cloud Function URL in settings.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ 
          error: 'Google Cloud Functions not configured. Please check your function URL in settings.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚡ MAXIMUM SPEED: ${gcfConfig.functionUrl}`);

    // Ensure campaign is marked as sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', campaignId);

    // Get emails to send (from resumeFromIndex onwards)
    const emailsToSend = preparedEmails.slice(resumeFromIndex);
    console.log(`⚡ SENDING ${emailsToSend.length} emails at MAXIMUM SPEED starting from index ${resumeFromIndex}`);
    
    // Respect user's account selection from campaign config
    const selectedAccountIds = campaign.config?.selectedAccounts || [];
    console.log('Selected account IDs from campaign:', selectedAccountIds);
    
    // Group emails by account for ultra-optimized processing - ONLY USE SELECTED ACCOUNTS
    const emailsByAccount = new Map();
    emailsToSend.forEach((email, index) => {
      const accountId = email.account_id;
      
      // Only include emails from selected accounts
      if (selectedAccountIds.length > 0 && !selectedAccountIds.includes(accountId)) {
        console.log(`Skipping email for non-selected account: ${accountId}`);
        return;
      }
      
      if (!emailsByAccount.has(accountId)) {
        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: email.accountConfig || {},
          emails: [],
          accountInfo: {
            name: email.fromName || 'Unknown',
            email: email.fromEmail || 'unknown@domain.com'
          }
        });
      }
      emailsByAccount.get(accountId).emails.push({
        recipient: email.recipient,
        subject: email.subject,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
        globalIndex: resumeFromIndex + index
      });
    });

    const actualEmailsToSend = Array.from(emailsByAccount.values()).reduce((total, account) => total + account.emails.length, 0);
    console.log(`⚡ ULTRA-OPTIMIZED: ${actualEmailsToSend} emails using ${emailsByAccount.size} selected accounts`);

    if (actualEmailsToSend === 0) {
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'No emails to send with selected accounts. Please check your account selection.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ error: 'No emails to send with selected accounts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare MAXIMUM SPEED payload for Google Cloud Function
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      totalEmails: actualEmailsToSend,
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

    console.log(`🎯 MAXIMUM SPEED payload prepared for ${emailsByAccount.size} selected accounts, ${actualEmailsToSend} emails`);

    // Validate function URL format
    if (!gcfConfig.functionUrl.startsWith('https://')) {
      throw new Error('Invalid Google Cloud Function URL. Must start with https://');
    }

    // Send to Google Cloud Functions with MAXIMUM SPEED settings and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      const response = await fetch(gcfConfig.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-MaxSpeed/3.3',
          'X-Campaign-ID': campaignId,
          'X-Email-Count': actualEmailsToSend.toString(),
          'X-Max-Speed': 'true',
          'X-Ultra-Fast': 'true'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`⚡ Google Cloud MAXIMUM SPEED response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`💥 Google Cloud CRITICAL ERROR: ${response.status} - ${errorText}`);
        
        // Update campaign with error
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Google Cloud error: ${response.status} - ${errorText}. Check your function URL: ${gcfConfig.functionUrl}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
        
        throw new Error(`Google Cloud Functions failed: ${response.status} - ${errorText}. Check your function URL.`);
      }

      const result = await response.json();
      console.log('✅ MAXIMUM SPEED Google Cloud response:', JSON.stringify(result, null, 2));

      // Handle response based on completion status
      if (result.success && result.completed) {
        console.log('🎉 MAXIMUM SPEED Campaign completed successfully!');
        
        // Final status update
        await supabase
          .from('email_campaigns')
          .update({ 
            status: result.sentCount > 0 ? 'sent' : 'failed',
            sent_count: result.sentCount || 0,
            completed_at: new Date().toISOString(),
            error_message: result.failedCount > 0 ? `${result.failedCount} emails failed to send` : null
          })
          .eq('id', campaignId);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'MAXIMUM SPEED campaign processing via Google Cloud Functions',
          details: result,
          configuration: {
            accounts_processing: emailsByAccount.size,
            total_emails: actualEmailsToSend,
            selected_accounts: selectedAccountIds.length,
            max_speed_mode: true,
            ultra_fast_processing: true,
            parallel_processing: true
          },
          gcf_url: gcfConfig.functionUrl,
          completed: result.completed || false,
          performance: { ...result.performance, maxSpeed: true, ultraFast: true }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Google Cloud Function request timed out after 2 minutes');
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('💥 CRITICAL MAXIMUM SPEED ERROR:', error);
    
    // Try to revert campaign status on any error
    try {
      if (campaignId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Maximum speed sender error: ${error.message}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }
    } catch (revertError) {
      console.error('Failed to revert campaign status:', revertError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: `MAXIMUM SPEED Google Cloud Functions failed: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
