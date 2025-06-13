
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
      config: campaign.config,
      recipientsLength: campaign.recipients?.length || 0
    })

    // Enhanced recipient parsing to handle multiple formats
    const rawRecipients = campaign.recipients || '';
    console.log('📝 Raw recipients string length:', rawRecipients.length);
    console.log('📝 Raw recipients preview (first 200 chars):', rawRecipients.substring(0, 200));

    let recipients = [];

    // Handle different recipient formats
    if (rawRecipients.includes('\n')) {
      // Newline separated
      recipients = rawRecipients
        .split('\n')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(',')) {
      // Comma separated
      recipients = rawRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(';')) {
      // Semicolon separated
      recipients = rawRecipients
        .split(';')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(' ')) {
      // Space separated
      recipients = rawRecipients
        .split(' ')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else {
      // Single email or try to parse as single
      const singleEmail = rawRecipients.trim();
      if (singleEmail && singleEmail.includes('@')) {
        recipients = [singleEmail];
      }
    }

    console.log(`📊 PARSING RESULTS: Found ${recipients.length} valid recipients from ${rawRecipients.length} character string`);
    
    if (recipients.length === 0) {
      console.error('❌ No valid recipients found after parsing');
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log sample recipients for verification
    console.log('📧 Sample recipients:', recipients.slice(0, 5));
    console.log('📧 Last recipients:', recipients.slice(-5));

    // Get rotation configuration
    const config = campaign.config || {}
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
      useSubjectRotation: config.rotation?.useSubjectRotation,
      totalRecipients: recipients.length
    })

    // Prepare ALL emails with proper rotation
    console.log(`🔧 PREPARING ALL ${recipients.length} EMAILS...`);
    const preparedEmails = []
    const batchSize = 1000; // Process in batches to avoid memory issues
    
    for (let batchStart = 0; batchStart < recipients.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, recipients.length);
      const currentBatch = recipients.slice(batchStart, batchEnd);
      
      console.log(`📦 Processing batch ${Math.floor(batchStart/batchSize) + 1}: emails ${batchStart + 1} to ${batchEnd}`);
      
      for (let i = 0; i < currentBatch.length; i++) {
        const globalIndex = batchStart + i; // Global index for rotation
        const recipient = currentBatch[i];
        
        // Apply rotation logic using global index
        const fromNameIndex = globalIndex % fromNames.length
        const subjectIndex = globalIndex % subjects.length
        
        const finalFromName = fromNames[fromNameIndex]
        const finalSubject = subjects[subjectIndex]

        preparedEmails.push({
          to: recipient,
          from_name: finalFromName,
          subject: finalSubject,
          html_content: campaign.html_content,
          text_content: campaign.text_content,
          prepared_at: new Date().toISOString()
        })
      }
      
      // Log progress every 1000 emails
      if ((batchEnd % 1000 === 0) || batchEnd === recipients.length) {
        console.log(`📈 Progress: ${batchEnd}/${recipients.length} emails prepared (${Math.round((batchEnd/recipients.length)*100)}%)`);
      }
    }

    console.log(`✅ PREPARATION COMPLETE: ${preparedEmails.length} emails fully prepared with rotation applied`);

    // Update campaign with ALL prepared emails
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

    console.log(`🎉 CAMPAIGN FULLY PREPARED: ${preparedEmails.length} emails ready for instant sending`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign prepared successfully with ${preparedEmails.length} emails`,
        emailCount: preparedEmails.length,
        rotationApplied: {
          fromNames: fromNames.length > 1,
          subjects: subjects.length > 1
        },
        preparationComplete: true
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
