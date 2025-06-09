
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleCloudConfig {
  functionUrl: string;
  projectId: string;
  region: string;
  functionName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId, rateLimit = 60, batchSize = 10 } = await req.json()

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) throw campaignError

    if (campaign.status !== 'prepared') {
      throw new Error('Campaign must be prepared before sending via Google Cloud Functions')
    }

    const preparedEmails = campaign.prepared_emails || [];
    if (preparedEmails.length === 0) {
      throw new Error('No prepared emails found for this campaign')
    }

    // Get Google Cloud configuration from campaign config
    const googleCloudConfig = campaign.config?.googleCloud as GoogleCloudConfig;
    if (!googleCloudConfig?.functionUrl) {
      throw new Error('Google Cloud Functions configuration not found in campaign config')
    }

    console.log(`Starting Google Cloud Functions send for campaign ${campaignId} with ${preparedEmails.length} emails`);

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Prepare the payload for Google Cloud Functions
    const payload = {
      campaignId,
      preparedEmails,
      rateLimit,
      batchSize,
      totalEmails: preparedEmails.length,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseKey
    };

    // Call Google Cloud Function
    const response = await fetch(googleCloudConfig.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('GOOGLE_CLOUD_TOKEN') || ''}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Cloud Function failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Google Cloud Function response:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Campaign sending initiated via Google Cloud Functions',
        totalEmails: preparedEmails.length,
        rateLimit,
        batchSize,
        gcfResponse: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error calling Google Cloud Functions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
