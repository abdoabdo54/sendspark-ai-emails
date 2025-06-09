
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
      return new Response('Missing parameters', { status: 400, headers: corsHeaders });
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Record the unsubscribe event
    await supabase
      .from('campaign_analytics')
      .insert({
        campaign_id: campaignId,
        subscriber_id: email,
        event_type: 'unsubscribe',
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
        user_agent: req.headers.get('user-agent') || '',
        event_data: {
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
      await supabase
        .from('campaign_stats')
        .update({
          unsubscribes: (stats.unsubscribes || 0) + 1
        })
        .eq('campaign_id', campaignId);
    } else {
      await supabase
        .from('campaign_stats')
        .insert({
          campaign_id: campaignId,
          opens: 0,
          unique_opens: 0,
          clicks: 0,
          unique_clicks: 0,
          bounces: 0,
          unsubscribes: 1,
          spam_complaints: 0,
          forwards: 0,
          delivered: 0
        });
    }

    // Update subscriber status
    await supabase
      .from('subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', email);

    // Return a simple confirmation page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
              background: #f8fafc;
              margin: 0;
              padding: 2rem;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container { 
              background: white;
              border-radius: 12px;
              padding: 3rem;
              text-align: center;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              max-width: 400px;
              width: 100%;
            }
            .icon { 
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 { 
              color: #1e293b;
              margin-bottom: 1rem;
              font-size: 1.5rem;
            }
            p { 
              color: #64748b;
              line-height: 1.6;
              margin-bottom: 1.5rem;
            }
            .email { 
              background: #f1f5f9;
              padding: 0.5rem 1rem;
              border-radius: 6px;
              font-family: monospace;
              color: #334155;
              margin: 1rem 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from our email list.</p>
            <div class="email">${email}</div>
            <p>You will no longer receive marketing emails from us. If you change your mind, you can resubscribe at any time.</p>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return new Response('Error processing unsubscribe', { status: 500, headers: corsHeaders });
  }
})
