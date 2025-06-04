
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1x1 transparent pixel
const pixelData = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaign');
    const email = url.searchParams.get('email');

    if (!campaignId || !email) {
      return new Response(pixelData, {
        headers: { 'Content-Type': 'image/gif', ...corsHeaders }
      });
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if this open was already tracked
    const { data: existingOpen } = await supabase
      .from('campaign_analytics')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('subscriber_id', email) // Using email as subscriber_id for simplicity
      .eq('event_type', 'open')
      .single()

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
            first_open: true
          }
        })

      // Update campaign stats
      await supabase.rpc('increment_campaign_opens', {
        campaign_id: campaignId
      })
    }

    // Return the tracking pixel
    return new Response(pixelData, {
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
    // Always return the pixel even if tracking fails
    return new Response(pixelData, {
      headers: { 'Content-Type': 'image/gif', ...corsHeaders }
    });
  }
})
