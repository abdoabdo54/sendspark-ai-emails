import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleCloudRequest {
  campaignId: string;
  resumeFromIndex?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 OPTIMIZED BATCH PROCESSING for campaign');

    const { campaignId, resumeFromIndex = 0 }: GoogleCloudRequest = await req.json();
    console.log('Raw request body:', JSON.stringify({ campaignId, resumeFromIndex }, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign with prepared config
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    // Determine mode based on campaign config
    const campaignConfig = campaign.config || {};
    const sendingMode = campaignConfig.sendingMode || 'controlled';
    
    console.log('📊 Campaign sending mode:', sendingMode);

    // Get Google Cloud Function URL
    let googleCloudFunctionUrl = '';
    
    if (sendingMode === 'fast' || sendingMode === 'zero-delay') {
      console.log('Using Google Cloud config for FAST/ZERO-DELAY mode');
      if (campaignConfig.googleCloudFunctions?.enabled && campaignConfig.googleCloudFunctions?.functionUrl) {
        googleCloudFunctionUrl = campaignConfig.googleCloudFunctions.functionUrl;
        console.log(`⚡ ${sendingMode.toUpperCase()} MODE:`, googleCloudFunctionUrl);
      } else {
        throw new Error(`Google Cloud Functions configuration missing for ${sendingMode} mode`);
      }
    } else {
      console.log('Using Google Cloud config for CONTROLLED mode');
      if (campaignConfig.googleCloudFunctions?.enabled && campaignConfig.googleCloudFunctions?.functionUrl) {
        googleCloudFunctionUrl = campaignConfig.googleCloudFunctions.functionUrl;
        console.log('⚡ CONTROLLED MODE:', googleCloudFunctionUrl);
      } else {
        throw new Error('Google Cloud Functions configuration missing for controlled mode');
      }
    }

    // OPTIMIZED: Handle batch processing approach
    const preparedEmails = campaign.prepared_emails || [];
    
    // Check if this is the new optimized format
    if (preparedEmails.length === 1 && preparedEmails[0].type === 'batch_config') {
      console.log('🚀 OPTIMIZED: Using batch processing mode');
      
      const batchConfig = preparedEmails[0].config;
      const totalRecipients = batchConfig.recipientCount;
      
      console.log(`⚡ OPTIMIZED: Processing ${totalRecipients} emails with ${batchConfig.accounts.length} accounts`);

      // Parse recipients on-demand for batch processing
      const allRecipients = campaign.recipients.split(',').map((email: string) => email.trim()).filter((email: string) => email.length > 0);
      const emailsToSend = allRecipients.slice(resumeFromIndex);
      
      if (emailsToSend.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'All emails already sent',
          totalEmails: totalRecipients,
          alreadySent: resumeFromIndex
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Group emails by account for balanced distribution
      const emailsByAccount: { [accountId: string]: any } = {};

      emailsToSend.forEach((email, index) => {
        const accountIndex = index % batchConfig.accounts.length;
        const account = batchConfig.accounts[accountIndex];
        
        if (!emailsByAccount[account.id]) {
          emailsByAccount[account.id] = {
            type: account.type,
            config: account.config,
            accountInfo: {
              id: account.id,
              name: account.name || account.email,
              email: account.email
            },
            emails: []
          };
        }
        
        // Create email object on-demand
        const fromNameIndex = batchConfig.useFromNameRotation ? index % batchConfig.fromNames.length : 0;
        const subjectIndex = batchConfig.useSubjectRotation ? index % batchConfig.subjects.length : 0;
        
        emailsByAccount[account.id].emails.push({
          to: email,
          subject: batchConfig.subjects[subjectIndex] || campaign.subject,
          from_name: batchConfig.fromNames[fromNameIndex] || campaign.from_name,
          html_content: batchConfig.htmlContent,
          text_content: batchConfig.textContent,
          send_method: 'apps-script'
        });
      });

      console.log(`🎯 OPTIMIZED ${sendingMode.toUpperCase()} MODE payload prepared for ${batchConfig.accounts.length} accounts, ${emailsToSend.length} emails`);

      // Prepare rotation config
      const rotation = {
        useFromNameRotation: batchConfig.useFromNameRotation || false,
        fromNames: batchConfig.fromNames || [],
        useSubjectRotation: batchConfig.useSubjectRotation || false,
        subjects: batchConfig.subjects || []
      };

      // Prepare test after config with automatic inclusion
      const testAfterConfig = {
        useTestAfter: campaignConfig.useTestAfter || false,
        testAfterEmail: campaignConfig.testAfterEmail || '',
        testAfterCount: campaignConfig.testAfterCount || 100
      };

      // Prepare custom rate limiting config with zero delay override
      const customRateLimit = campaignConfig.customRateLimit || {};

      // Enhanced configuration for zero delay mode
      const enhancedConfig = {
        sendingMode,
        useCustomRateLimit: campaignConfig.useCustomRateLimit || false,
        bypassAllRateLimits: sendingMode === 'zero-delay' || campaignConfig.bypassAllRateLimits || true, // Default to true for speed
        zeroDelayMode: sendingMode === 'zero-delay',
        forceMaxSpeed: sendingMode === 'zero-delay',
        optimizedBatchMode: true
      };

      // Call Google Cloud Function with enhanced payload
      const gcfPayload = {
        campaignId,
        emailsByAccount,
        supabaseUrl,
        supabaseKey: supabaseServiceKey,
        config: enhancedConfig,
        rotation,
        testAfterConfig,
        customRateLimit
      };

      console.log(`⚡ Google Cloud OPTIMIZED ${sendingMode.toUpperCase()} response: calling function`);

      const gcfResponse = await fetch(googleCloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gcfPayload)
      });

      if (!gcfResponse.ok) {
        const errorText = await gcfResponse.text();
        throw new Error(`Google Cloud Function error: ${gcfResponse.status} - ${errorText}`);
      }

      const gcfResult = await gcfResponse.json();
      console.log(`✅ OPTIMIZED ${sendingMode.toUpperCase()} MODE Google Cloud response:`, JSON.stringify(gcfResult, null, 2));

      console.log(`🎉 OPTIMIZED ${sendingMode.toUpperCase()} MODE Campaign completed successfully!`);

      return new Response(JSON.stringify({
        success: true,
        mode: sendingMode,
        message: `OPTIMIZED ${sendingMode.toUpperCase()} MODE Google Cloud Function called successfully`,
        result: gcfResult,
        configuration: {
          total_emails: emailsToSend.length,
          accounts_used: batchConfig.accounts.length,
          google_cloud_function: googleCloudFunctionUrl,
          rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
          test_after_enabled: testAfterConfig.useTestAfter,
          test_after_automatically_included: true,
          custom_rate_limit_enabled: campaignConfig.useCustomRateLimit,
          bypass_all_rate_limits: enhancedConfig.bypassAllRateLimits,
          zero_delay_mode: enhancedConfig.zeroDelayMode,
          optimized_batch_mode: true
        }
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
      
    } else {
      // Legacy format - keep existing code for backward compatibility
      console.log('📧 LEGACY: Using traditional processing mode');
      
      // ... keep existing code for legacy processing mode
      const emailsToSend = preparedEmails.slice(resumeFromIndex);
      
      if (emailsToSend.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'All emails already sent',
          totalEmails: preparedEmails.length,
          alreadySent: resumeFromIndex
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get selected account IDs from campaign config
      const selectedAccountIds = campaignConfig.selectedAccounts || [];
      console.log('Selected account IDs from campaign:', selectedAccountIds);

      // Get account details for selected accounts
      let accountQuery = supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', campaign.organization_id)
        .eq('is_active', true);

      if (selectedAccountIds.length > 0) {
        accountQuery = accountQuery.in('id', selectedAccountIds);
      }

      const { data: accounts, error: accountsError } = await accountQuery;

      if (accountsError || !accounts?.length) {
        throw new Error(`No valid accounts found: ${accountsError?.message}`);
      }

      console.log(`⚡ LEGACY SENDING ${emailsToSend.length} emails in ${sendingMode.toUpperCase()} MODE starting from index ${resumeFromIndex}`);

      // Group emails by account for balanced distribution
      const emailsByAccount: { [accountId: string]: any } = {};

      emailsToSend.forEach((email, index) => {
        const accountIndex = index % accounts.length;
        const account = accounts[accountIndex];
        
        if (!emailsByAccount[account.id]) {
          emailsByAccount[account.id] = {
            type: account.type,
            config: account.config,
            accountInfo: {
              id: account.id,
              name: account.name,
              email: account.email
            },
            emails: []
          };
        }
        
        emailsByAccount[account.id].emails.push(email);
      });

      console.log(`🎯 LEGACY ${sendingMode.toUpperCase()} MODE payload prepared for ${accounts.length} selected accounts, ${emailsToSend.length} emails`);

      // Prepare rotation config
      const rotation = {
        useFromNameRotation: campaignConfig.useFromNameRotation || false,
        fromNames: campaignConfig.fromNames || [],
        useSubjectRotation: campaignConfig.useSubjectRotation || false,
        subjects: campaignConfig.subjects || []
      };

      // Prepare test after config with automatic inclusion
      const testAfterConfig = {
        useTestAfter: campaignConfig.useTestAfter || false,
        testAfterEmail: campaignConfig.testAfterEmail || '',
        testAfterCount: campaignConfig.testAfterCount || 100
      };

      // Prepare custom rate limiting config with zero delay override
      const customRateLimit = campaignConfig.customRateLimit || {};

      // Enhanced configuration for zero delay mode
      const enhancedConfig = {
        sendingMode,
        useCustomRateLimit: campaignConfig.useCustomRateLimit || false,
        bypassAllRateLimits: sendingMode === 'zero-delay' || campaignConfig.bypassAllRateLimits || false,
        zeroDelayMode: sendingMode === 'zero-delay',
        forceMaxSpeed: sendingMode === 'zero-delay'
      };

      // Call Google Cloud Function with enhanced payload
      const gcfPayload = {
        campaignId,
        emailsByAccount,
        supabaseUrl,
        supabaseKey: supabaseServiceKey,
        config: enhancedConfig,
        rotation,
        testAfterConfig,
        customRateLimit
      };

      const gcfResponse = await fetch(googleCloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gcfPayload)
      });

      if (!gcfResponse.ok) {
        const errorText = await gcfResponse.text();
        throw new Error(`Google Cloud Function error: ${gcfResponse.status} - ${errorText}`);
      }

      const gcfResult = await gcfResponse.json();
      console.log(`✅ LEGACY ${sendingMode.toUpperCase()} MODE Google Cloud response:`, JSON.stringify(gcfResult, null, 2));

      return new Response(JSON.stringify({
        success: true,
        mode: sendingMode,
        message: `LEGACY ${sendingMode.toUpperCase()} MODE Google Cloud Function called successfully`,
        result: gcfResult,
        configuration: {
          total_emails: emailsToSend.length,
          accounts_used: accounts.length,
          google_cloud_function: googleCloudFunctionUrl,
          rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
          test_after_enabled: testAfterConfig.useTestAfter,
          test_after_automatically_included: true,
          custom_rate_limit_enabled: campaignConfig.useCustomRateLimit,
          bypass_all_rate_limits: enhancedConfig.bypassAllRateLimits,
          zero_delay_mode: enhancedConfig.zeroDelayMode
        }
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

  } catch (error: any) {
    console.error('💥 CRITICAL ERROR in OPTIMIZED Google Cloud send:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
