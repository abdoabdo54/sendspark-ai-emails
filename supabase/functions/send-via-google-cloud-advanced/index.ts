
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

  let campaignId: string | null = null;

  try {
    const requestBody = await req.json();
    campaignId = requestBody.campaignId;

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🚀 Processing campaign ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Campaign not found: ${campaignError?.message || 'Unknown error'}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if campaign is prepared
    if (!['prepared', 'paused', 'sending'].includes(campaign.status)) {
      console.error('Invalid campaign status:', campaign.status);
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Campaign must be prepared first. Current status: ${campaign.status}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ error: `Campaign must be prepared first. Current status: ${campaign.status}` }),
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

    // Get Google Cloud Function URL
    let gcfUrl = null;
    
    if (campaign.config?.googleCloudFunctions?.functionUrl) {
      gcfUrl = campaign.config.googleCloudFunctions.functionUrl;
    } else {
      const { data: orgSettings } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', campaign.organization_id)
        .single();
      
      if (orgSettings?.settings?.googleCloudFunctions?.functionUrl) {
        gcfUrl = orgSettings.settings.googleCloudFunctions.functionUrl;
      }
    }

    if (!gcfUrl) {
      console.error('No Google Cloud Function URL configured');
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'Google Cloud Function URL not configured. Please configure it in Settings → Google Cloud Config.',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      return new Response(
        JSON.stringify({ 
          error: 'Google Cloud Function URL not configured. Please configure it in Settings → Google Cloud Config.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Using Google Cloud Function URL: ${gcfUrl}`);

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ 
        status: 'sending',
        sent_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', campaignId);

    // Group emails by account with proper accountInfo structure
    const emailsByAccount = new Map();
    preparedEmails.forEach((email) => {
      const accountId = email.account_id;
      
      if (!emailsByAccount.has(accountId)) {
        emailsByAccount.set(accountId, {
          type: email.accountType,
          config: email.accountConfig || {},
          emails: [],
          accountInfo: {
            name: email.fromName || 'Unknown',
            email: email.fromEmail || email.accountConfig?.user || email.accountConfig?.email || 'unknown@domain.com'
          }
        });
      }
      emailsByAccount.get(accountId).emails.push({
        recipient: email.recipient,
        subject: email.subject,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        htmlContent: email.htmlContent,
        textContent: email.textContent
      });
    });

    console.log(`Processing ${preparedEmails.length} emails using ${emailsByAccount.size} accounts`);

    // Prepare simplified payload for Google Cloud Function
    const payload = {
      campaignId,
      emailsByAccount: Object.fromEntries(emailsByAccount),
      supabaseUrl,
      supabaseKey,
      config: {
        sendingMode: campaign.config?.sendingMode || 'controlled',
        emailsPerSecond: campaign.config?.emailsPerSecond || 1
      },
      rotation: {
        useFromNameRotation: campaign.config?.useFromNameRotation || false,
        fromNames: campaign.config?.fromNames || [],
        useSubjectRotation: campaign.config?.useSubjectRotation || false,
        subjects: campaign.config?.subjects || []
      }
    };

    console.log(`Sending payload to Google Cloud Function`);

    // Send to Google Cloud Function
    const response = await fetch(gcfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`Google Cloud Function response: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Cloud Function error: ${response.status} - ${errorText}`);
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Google Cloud Function error: ${response.status} - ${errorText}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      throw new Error(`Google Cloud Function failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Google Cloud Function response:', result);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign sent successfully via Google Cloud Function',
        details: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Critical error:', error);
    
    try {
      if (campaignId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Campaign sender error: ${error.message}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }
    } catch (revertError) {
      console.error('Failed to revert campaign status:', revertError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: `Campaign sending failed: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
