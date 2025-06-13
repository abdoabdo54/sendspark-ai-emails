
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
    const { campaignId } = await req.json()

    console.log('🔧 REAL PREPARATION: Starting preparation for campaign:', campaignId)

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError)
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (campaign.status !== 'draft') {
      console.error('❌ Campaign not in draft status:', campaign.status)
      return new Response(
        JSON.stringify({ error: 'Campaign must be in draft status to prepare' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📧 Processing campaign:', {
      id: campaignId,
      subject: campaign.subject,
      config: campaign.config
    })

    // Parse recipients
    const recipients = campaign.recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email && email.includes('@'))

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📊 Found ${recipients.length} valid recipients`)

    // Prepare emails with rotation applied
    const preparedEmails = []
    const config = campaign.config || {}

    // Get rotation arrays
    const fromNames = config.rotation?.useFromNameRotation && config.rotation.fromNames?.length > 0 
      ? config.rotation.fromNames 
      : [campaign.from_name]
    
    const subjects = config.rotation?.useSubjectRotation && config.rotation.subjects?.length > 0 
      ? config.rotation.subjects 
      : [campaign.subject]

    console.log('🔄 Rotation setup:', {
      fromNamesCount: fromNames.length,
      subjectsCount: subjects.length,
      useFromRotation: config.rotation?.useFromNameRotation,
      useSubjectRotation: config.rotation?.useSubjectRotation
    })

    // Prepare each email with proper rotation
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      
      // Apply rotation logic
      const fromNameIndex = i % fromNames.length
      const subjectIndex = i % subjects.length
      
      const finalFromName = fromNames[fromNameIndex]
      const finalSubject = subjects[subjectIndex]

      console.log(`📧 Email ${i + 1}: ${recipient} - FROM: "${finalFromName}" (${fromNameIndex}) - SUBJECT: "${finalSubject}" (${subjectIndex})`)

      preparedEmails.push({
        to: recipient,
        from_name: finalFromName,
        subject: finalSubject,
        html_content: campaign.html_content,
        text_content: campaign.text_content,
        prepared_at: new Date().toISOString()
      })
    }

    // Update campaign with prepared emails (REMOVED updated_at field that doesn't exist)
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        prepared_emails: preparedEmails,
        total_recipients: recipients.length
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Failed to update campaign:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update campaign' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Campaign prepared successfully: ${preparedEmails.length} emails ready`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign prepared successfully with ${preparedEmails.length} emails`,
        emailCount: preparedEmails.length,
        rotationApplied: {
          fromNames: fromNames.length > 1,
          subjects: subjects.length > 1
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in prepare-campaign:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
