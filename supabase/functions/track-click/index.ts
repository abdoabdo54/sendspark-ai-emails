
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
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaign');
    const email = url.searchParams.get('email');
    const targetUrl = url.searchParams.get('url');

    if (!campaignId || !email || !targetUrl) {
      return new Response('Missing parameters', { status: 400, headers: corsHeaders });
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Record the click event
    await supabase
      .from('campaign_analytics')
      .insert({
        campaign_id: campaignId,
        subscriber_id: email,
        event_type: 'click',
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
        user_agent: req.headers.get('user-agent') || '',
        event_data: {
          timestamp: new Date().toISOString(),
          target_url: targetUrl
        }
      })

    // Update campaign stats
    await supabase.rpc('increment_campaign_clicks', {
      campaign_id: campaignId
    })

    // Redirect to the target URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': decodeURIComponent(targetUrl),
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error tracking click:', error);
    // Redirect to target URL even if tracking fails
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': decodeURIComponent(targetUrl),
          ...corsHeaders
        }
      });
    }
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
})
