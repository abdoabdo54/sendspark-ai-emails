
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

    if (!campaignId || !email) {
      // Return a 1x1 transparent pixel even if parameters are missing
      const pixel = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
        0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
        0x44, 0x01, 0x00, 0x3B
      ]);
      
      return new Response(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...corsHeaders
        }
      });
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if this open was already tracked (prevent duplicate tracking)
    const { data: existingOpen } = await supabase
      .from('campaign_analytics')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('subscriber_id', email)
      .eq('event_type', 'open')
      .limit(1)
      .single();

    if (!existingOpen) {
      // Record the open event
      await supabase
        .from('campaign_analytics')
        .insert({
          campaign_id: campaignId,
          subscriber_id: email,
          event_type: 'open',
          ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
          user_agent: req.headers.get('user-agent') || '',
          event_data: {
            timestamp: new Date().toISOString(),
            unique: true
          }
        })

      // Update campaign stats
      const { data: stats } = await supabase
        .from('campaign_stats')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();

      if (stats) {
        // Update existing stats
        await supabase
          .from('campaign_stats')
          .update({
            opens: (stats.opens || 0) + 1,
            unique_opens: (stats.unique_opens || 0) + 1
          })
          .eq('campaign_id', campaignId);
      } else {
        // Create new stats record
        await supabase
          .from('campaign_stats')
          .insert({
            campaign_id: campaignId,
            opens: 1,
            unique_opens: 1,
            clicks: 0,
            unique_clicks: 0,
            bounces: 0,
            unsubscribes: 0,
            spam_complaints: 0,
            forwards: 0,
            delivered: 0
          });
      }

      console.log(`Tracked unique open for campaign ${campaignId}, email ${email}`);
    } else {
      // Record non-unique open
      await supabase
        .from('campaign_analytics')
        .insert({
          campaign_id: campaignId,
          subscriber_id: email,
          event_type: 'open',
          ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
          user_agent: req.headers.get('user-agent') || '',
          event_data: {
            timestamp: new Date().toISOString(),
            unique: false
          }
        })

      // Update total opens count
      await supabase
        .from('campaign_stats')
        .update({
          opens: supabase.rpc('increment', { campaign_id: campaignId, field: 'opens' })
        })
        .eq('campaign_id', campaignId);

      console.log(`Tracked repeat open for campaign ${campaignId}, email ${email}`);
    }

    // Return a 1x1 transparent pixel
    const pixel = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
      0x44, 0x01, 0x00, 0x3B
    ]);

    return new Response(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error tracking open:', error);
    
    // Always return a pixel, even on error
    const pixel = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
      0x44, 0x01, 0x00, 0x3B
    ]);
    
    return new Response(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...corsHeaders
      }
    });
  }
})
