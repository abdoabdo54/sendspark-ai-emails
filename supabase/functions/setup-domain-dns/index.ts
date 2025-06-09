
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
    const { domain_id, domain_name, namecheap_config, organization_id } = await req.json()

    console.log('Setting up DNS for domain:', domain_name)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Namecheap API configuration
    const namecheapApiUrl = namecheap_config.sandbox 
      ? 'https://api.sandbox.namecheap.com/xml.response'
      : 'https://api.namecheap.com/xml.response'

    // Get client IP for Namecheap API
    const clientIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     '127.0.0.1'

    // Define DNS records for email tracking
    const dnsRecords = [
      {
        type: 'CNAME',
        name: 'track',
        value: `track.${organization_id}.emailtracker.app`, // Replace with your tracking service
        ttl: 300
      },
      {
        type: 'CNAME', 
        name: 'unsubscribe',
        value: `unsubscribe.${organization_id}.emailtracker.app`, // Replace with your unsubscribe service
        ttl: 300
      },
      {
        type: 'TXT',
        name: '@',
        value: `v=spf1 include:_spf.${organization_id}.emailtracker.app ~all`,
        ttl: 300
      }
    ]

    // Set up DNS records via Namecheap API
    for (const record of dnsRecords) {
      try {
        const params = new URLSearchParams({
          ApiUser: namecheap_config.username,
          ApiKey: namecheap_config.api_key,
          UserName: namecheap_config.username,
          Command: 'namecheap.domains.dns.setHosts',
          ClientIp: clientIp,
          SLD: domain_name.split('.')[0],
          TLD: domain_name.split('.').slice(1).join('.'),
          HostName1: record.name,
          RecordType1: record.type,
          Address1: record.value,
          TTL1: record.ttl.toString()
        })

        const response = await fetch(`${namecheapApiUrl}?${params}`)
        const responseText = await response.text()
        
        console.log(`DNS record ${record.type} ${record.name} set:`, responseText)
      } catch (error) {
        console.error(`Failed to set DNS record ${record.type} ${record.name}:`, error)
      }
    }

    // Update domain in database
    const { error: updateError } = await supabaseClient
      .from('domains')
      .update({
        is_verified: true,
        dns_records: {
          tracking_subdomain: `track.${domain_name}`,
          unsubscribe_subdomain: `unsubscribe.${domain_name}`,
          spf_record: `v=spf1 include:_spf.${organization_id}.emailtracker.app ~all`,
          configured_at: new Date().toISOString(),
          records: dnsRecords
        }
      })
      .eq('id', domain_id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'DNS configuration completed',
        tracking_url: `https://track.${domain_name}`,
        unsubscribe_url: `https://unsubscribe.${domain_name}`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error setting up domain DNS:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
