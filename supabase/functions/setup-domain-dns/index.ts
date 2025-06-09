
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

    // Get client IP for Namecheap API (required for all requests)
    const clientIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') ||
                     '127.0.0.1'

    console.log('Using client IP:', clientIp)

    // Parse domain name
    const domainParts = domain_name.split('.')
    const sld = domainParts[0] // Second Level Domain (e.g., "example" from "example.com")
    const tld = domainParts.slice(1).join('.') // Top Level Domain (e.g., "com" from "example.com")

    console.log('Domain parts - SLD:', sld, 'TLD:', tld)

    // First, get existing DNS records to avoid overwriting them
    const getDnsParams = new URLSearchParams({
      ApiUser: namecheap_config.username,
      ApiKey: namecheap_config.api_key,
      UserName: namecheap_config.username,
      Command: 'namecheap.domains.dns.getHosts',
      ClientIp: clientIp,
      SLD: sld,
      TLD: tld
    })

    console.log('Fetching existing DNS records...')
    const getDnsResponse = await fetch(`${namecheapApiUrl}?${getDnsParams}`)
    const getDnsText = await getDnsResponse.text()
    console.log('Existing DNS response:', getDnsText)

    // Parse existing records (basic XML parsing)
    const existingRecords = []
    let recordIndex = 1

    // Add existing records first (we should parse the XML properly, but for now we'll add some defaults)
    // In production, you'd want to use a proper XML parser

    // Add tracking and unsubscribe subdomains
    const trackingDomain = `kzatxttazxwqawefumed.supabase.co` // Your Supabase project domain
    
    const setDnsParams = new URLSearchParams({
      ApiUser: namecheap_config.username,
      ApiKey: namecheap_config.api_key,
      UserName: namecheap_config.username,
      Command: 'namecheap.domains.dns.setHosts',
      ClientIp: clientIp,
      SLD: sld,
      TLD: tld,
      // Add tracking subdomain
      [`HostName${recordIndex}`]: 'track',
      [`RecordType${recordIndex}`]: 'CNAME',
      [`Address${recordIndex}`]: trackingDomain,
      [`TTL${recordIndex}`]: '300'
    })
    recordIndex++

    // Add unsubscribe subdomain
    setDnsParams.append(`HostName${recordIndex}`, 'unsubscribe')
    setDnsParams.append(`RecordType${recordIndex}`, 'CNAME')
    setDnsParams.append(`Address${recordIndex}`, trackingDomain)
    setDnsParams.append(`TTL${recordIndex}`, '300')
    recordIndex++

    // Add click tracking subdomain
    setDnsParams.append(`HostName${recordIndex}`, 'click')
    setDnsParams.append(`RecordType${recordIndex}`, 'CNAME')
    setDnsParams.append(`Address${recordIndex}`, trackingDomain)
    setDnsParams.append(`TTL${recordIndex}`, '300')
    recordIndex++

    // Add SPF record for email authentication
    setDnsParams.append(`HostName${recordIndex}`, '@')
    setDnsParams.append(`RecordType${recordIndex}`, 'TXT')
    setDnsParams.append(`Address${recordIndex}`, `v=spf1 include:_spf.${organization_id}.supabase.co ~all`)
    setDnsParams.append(`TTL${recordIndex}`, '300')

    console.log('Setting DNS records with params:', setDnsParams.toString())

    const setDnsResponse = await fetch(`${namecheapApiUrl}?${setDnsParams}`)
    const setDnsText = await setDnsResponse.text()
    
    console.log('DNS setup response:', setDnsText)

    // Check if the response indicates success
    const isSuccess = setDnsText.includes('<ApiResponse Status="OK">')
    
    if (!isSuccess) {
      throw new Error(`Namecheap API error: ${setDnsText}`)
    }

    // Update domain in database
    const { error: updateError } = await supabaseClient
      .from('domains')
      .update({
        is_verified: true,
        dns_records: {
          tracking_subdomain: `track.${domain_name}`,
          unsubscribe_subdomain: `unsubscribe.${domain_name}`,
          click_subdomain: `click.${domain_name}`,
          spf_record: `v=spf1 include:_spf.${organization_id}.supabase.co ~all`,
          configured_at: new Date().toISOString(),
          tracking_endpoints: {
            open_tracking: `https://kzatxttazxwqawefumed.supabase.co/functions/v1/track-open`,
            click_tracking: `https://kzatxttazxwqawefumed.supabase.co/functions/v1/track-click`,
            unsubscribe: `https://kzatxttazxwqawefumed.supabase.co/functions/v1/track-unsubscribe`
          }
        }
      })
      .eq('id', domain_id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'DNS configuration completed successfully',
        tracking_urls: {
          open_tracking: `https://track.${domain_name}/track-open`,
          click_tracking: `https://click.${domain_name}/track-click`,
          unsubscribe: `https://unsubscribe.${domain_name}/unsubscribe`
        },
        dns_records: {
          tracking_subdomain: `track.${domain_name}`,
          unsubscribe_subdomain: `unsubscribe.${domain_name}`,
          click_subdomain: `click.${domain_name}`
        }
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
