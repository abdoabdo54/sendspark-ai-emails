
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
    console.log('🚀 DUAL MODE PROCESSING for campaign', req.body);

    const { campaignId, resumeFromIndex = 0 }: GoogleCloudRequest = await req.json();
    console.log('Raw request body:', JSON.stringify({ campaignId, resumeFromIndex }, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get campaign with prepared emails and config
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
    
    if (sendingMode === 'fast') {
      // Use Google Cloud config for fast mode
      console.log('Using Google Cloud config for CONTROLLED mode');
      if (campaignConfig.googleCloudFunctions?.enabled && campaignConfig.googleCloudFunctions?.functionUrl) {
        googleCloudFunctionUrl = campaignConfig.googleCloudFunctions.functionUrl;
        console.log('⚡ CONTROLLED MODE:', googleCloudFunctionUrl);
      } else {
        throw new Error('Google Cloud Functions configuration missing for fast mode');
      }
    } else {
      // Use Google Cloud config for controlled mode
      console.log('Using Google Cloud config for CONTROLLED mode');
      if (campaignConfig.googleCloudFunctions?.enabled && campaignConfig.googleCloudFunctions?.functionUrl) {
        googleCloudFunctionUrl = campaignConfig.googleCloudFunctions.functionUrl;
        console.log('⚡ CONTROLLED MODE:', googleCloudFunctionUrl);
      } else {
        throw new Error('Google Cloud Functions configuration missing for controlled mode');
      }
    }

    const preparedEmails = campaign.prepared_emails || [];
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

    console.log(`⚡ SENDING ${emailsToSend.length} emails in ${sendingMode.toUpperCase()} MODE starting from index ${resumeFromIndex}`);

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

    console.log(`🎯 ${sendingMode.toUpperCase()} MODE payload prepared for ${accounts.length} selected accounts, ${emailsToSend.length} emails`);

    // Prepare rotation config
    const rotation = {
      useFromNameRotation: campaignConfig.useFromNameRotation || false,
      fromNames: campaignConfig.fromNames || [],
      useSubjectRotation: campaignConfig.useSubjectRotation || false,
      subjects: campaignConfig.subjects || []
    };

    // Prepare test after config
    const testAfterConfig = {
      useTestAfter: campaignConfig.useTestAfter || false,
      testAfterEmail: campaignConfig.testAfterEmail || '',
      testAfterCount: campaignConfig.testAfterCount || 100
    };

    // Prepare custom rate limiting config
    const customRateLimit = campaignConfig.customRateLimit || {};

    // Call Google Cloud Function with enhanced payload
    const gcfPayload = {
      campaignId,
      emailsByAccount,
      supabaseUrl,
      supabaseKey: supabaseServiceKey,
      config: {
        sendingMode,
        useCustomRateLimit: campaignConfig.useCustomRateLimit || false
      },
      rotation,
      testAfterConfig,
      customRateLimit
    };

    console.log(`⚡ Google Cloud ${sendingMode.toUpperCase()} response: 200`);

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
    console.log(`✅ ${sendingMode.toUpperCase()} MODE Google Cloud response:`, JSON.stringify(gcfResult, null, 2));

    console.log(`🎉 ${sendingMode.toUpperCase()} MODE Campaign completed successfully!`);

    return new Response(JSON.stringify({
      success: true,
      mode: sendingMode,
      message: `${sendingMode.toUpperCase()} MODE Google Cloud Function called successfully`,
      result: gcfResult,
      configuration: {
        total_emails: emailsToSend.length,
        accounts_used: accounts.length,
        google_cloud_function: googleCloudFunctionUrl,
        rotation_enabled: rotation.useFromNameRotation || rotation.useSubjectRotation,
        test_after_enabled: testAfterConfig.useTestAfter,
        custom_rate_limit_enabled: campaignConfig.useCustomRateLimit
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 CRITICAL ERROR in Google Cloud send:', error);

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
