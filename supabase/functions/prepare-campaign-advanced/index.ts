
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
    const { 
      campaignId, 
      selectedAccounts, 
      rotation = {}, 
      rateLimit = {},
      googleCloudConfig = null
    } = await req.json()

    console.log(`🚀 OPTIMIZED preparation for campaign ${campaignId} with ${selectedAccounts?.length || 0} accounts`);

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
      throw new Error('Campaign not found')
    }

    // Get selected accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('id', selectedAccounts || [])
      .eq('is_active', true)

    if (accountsError) throw accountsError
    if (!accounts || accounts.length === 0) {
      throw new Error('No active accounts found')
    }

    console.log(`✅ Using ${accounts.length} accounts for OPTIMIZED processing`);

    // Parse recipients - memory efficient approach
    const recipientsText = campaign.recipients || '';
    const recipientCount = recipientsText.split(',').filter((email: string) => email.trim().length > 0).length;

    if (recipientCount === 0) {
      throw new Error('No valid recipients found')
    }

    console.log(`📧 Processing ${recipientCount} recipients with BATCH optimization`);

    // Calculate total sending capacity (no rate limits applied)
    const totalCapacity = accounts.length * 10; // 10 emails per second per account (no limits)

    // Prepare FROM name and subject variations for rotation
    const fromNames = rotation.useFromNameRotation && rotation.fromNames?.length > 0 
      ? rotation.fromNames 
      : [campaign.from_name];
    
    const subjects = rotation.useSubjectRotation && rotation.subjects?.length > 0 
      ? rotation.subjects 
      : [campaign.subject];

    // MEMORY EFFICIENT: Instead of creating all emails in memory, 
    // we'll create a lightweight configuration object
    const preparedConfig = {
      campaignId,
      recipientCount,
      accounts: accounts.map(acc => ({
        id: acc.id,
        email: acc.email,
        type: acc.type,
        config: acc.config
      })),
      fromNames,
      subjects,
      htmlContent: campaign.html_content,
      textContent: campaign.text_content,
      useFromNameRotation: rotation.useFromNameRotation || false,
      useSubjectRotation: rotation.useSubjectRotation || false,
      preparedAt: new Date().toISOString()
    };

    // Update campaign with LIGHTWEIGHT prepared configuration
    const campaignConfig = {
      selectedAccounts,
      rotation,
      totalCapacity,
      preparedAt: new Date().toISOString(),
      optimizedMode: true,
      batchProcessing: true,
      // Include Google Cloud Functions config if provided
      ...(googleCloudConfig?.enabled && { googleCloudFunctions: googleCloudConfig })
    };

    // CRITICAL: Use lightweight prepared_emails array instead of full email objects
    const lightweightPrepared = [{
      type: 'batch_config',
      config: preparedConfig,
      total_recipients: recipientCount,
      accounts_count: accounts.length,
      prepared_at: new Date().toISOString()
    }];

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        total_recipients: recipientCount,
        prepared_emails: lightweightPrepared, // Lightweight approach
        config: campaignConfig
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log(`🎉 OPTIMIZED campaign ${campaignId} prepared successfully with ${recipientCount} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campaign prepared successfully with OPTIMIZED batch processing',
        totalEmails: recipientCount,
        accountsUsed: accounts.length,
        fromNameVariations: fromNames.length,
        subjectVariations: subjects.length,
        totalCapacity: `${totalCapacity} emails/second (no rate limits)`,
        optimizedMode: true,
        batchProcessing: true,
        config: campaignConfig
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 OPTIMIZED preparation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
