
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { orgName, subdomain, domain, userId } = await req.json()

    console.log('Creating super admin organization:', { orgName, subdomain, domain, userId })

    // Create organization with service role (bypasses RLS)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert([{
        name: orgName,
        subdomain: subdomain,
        domain: domain,
        subscription_plan: 'enterprise',
        monthly_email_limit: 1000000,
        is_active: true
      }])
      .select()
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      throw orgError
    }

    console.log('Organization created:', org)

    // Add user as super admin
    const { error: userError } = await supabase
      .from('organization_users')
      .insert([{
        organization_id: org.id,
        user_id: userId,
        role: 'super_admin',
        joined_at: new Date().toISOString(),
        is_active: true
      }])

    if (userError) {
      console.error('User role assignment error:', userError)
      throw userError
    }

    console.log('Super admin role assigned successfully')

    return new Response(
      JSON.stringify({ success: true, organization: org }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Super admin setup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
