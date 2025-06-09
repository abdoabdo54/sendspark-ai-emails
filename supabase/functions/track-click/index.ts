
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
          url: targetUrl,
          timestamp: new Date().toISOString()
        }
      })

    // Update campaign stats
    const { data: stats } = await supabase
      .from('campaign_stats')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (stats) {
      // Get unique clicks count
      const { data: uniqueClickers } = await supabase
        .from('campaign_analytics')
        .select('subscriber_id')
        .eq('campaign_id', campaignId)
        .eq('event_type', 'click');

      const uniqueClicksCount = new Set(uniqueClickers?.map(c => c.subscriber_id)).size;

      // Get total clicks count
      const { count: totalClicks } = await supabase
        .from('campaign_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('event_type', 'click');

      await supabase
        .from('campaign_stats')
        .update({
          clicks: totalClicks || 0,
          unique_clicks: uniqueClicksCount
        })
        .eq('campaign_id', campaignId);
    } else {
      await supabase
        .from('campaign_stats')
        .insert({
          campaign_id: campaignId,
          opens: 0,
          unique_opens: 0,
          clicks: 1,
          unique_clicks: 1,
          bounces: 0,
          unsubscribes: 0,
          spam_complaints: 0,
          forwards: 0,
          delivered: 0
        });
    }

    // Redirect to the target URL
    return new Response('', {
      status: 302,
      headers: {
        'Location': decodeURIComponent(targetUrl),
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error tracking click:', error);
    
    // Still redirect even if tracking fails
    const targetUrl = new URL(req.url).searchParams.get('url');
    if (targetUrl) {
      return new Response('', {
        status: 302,
        headers: {
          'Location': decodeURIComponent(targetUrl),
          ...corsHeaders
        }
      });
    }
    
    return new Response('Error processing click', { status: 500, headers: corsHeaders });
  }
})
