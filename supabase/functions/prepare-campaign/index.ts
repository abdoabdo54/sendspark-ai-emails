
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

    // Only allow preparation for draft and failed campaigns
    if (campaign.status !== 'draft' && campaign.status !== 'failed') {
      console.error('❌ Campaign status not suitable for preparation:', campaign.status)
      return new Response(
        JSON.stringify({ error: `Campaign must be in draft or failed status to prepare (current: ${campaign.status})` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📧 Processing campaign:', {
      id: campaignId,
      subject: campaign.subject,
      status: campaign.status,
      config: campaign.config,
      recipientsLength: campaign.recipients?.length || 0
    })

    // Enhanced recipient parsing to handle multiple formats
    const rawRecipients = campaign.recipients || '';
    console.log('📝 Raw recipients string length:', rawRecipients.length);

    let recipients = [];

    // Handle different recipient formats
    if (rawRecipients.includes('\n')) {
      recipients = rawRecipients
        .split('\n')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(',')) {
      recipients = rawRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(';')) {
      recipients = rawRecipients
        .split(';')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (rawRecipients.includes(' ')) {
      recipients = rawRecipients
        .split(' ')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else {
      const singleEmail = rawRecipients.trim();
      if (singleEmail && singleEmail.includes('@')) {
        recipients = [singleEmail];
      }
    }

    console.log(`📊 PARSING RESULTS: Found ${recipients.length} valid recipients`);
    
    if (recipients.length === 0) {
      console.error('❌ No valid recipients found after parsing');
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: 'No valid recipients found'
        })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ error: 'No valid recipients found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
      totalRecipients: recipients.length
    })

    // Add realistic processing delay based on email count
    const processingDelay = Math.min(recipients.length * 0.1, 5000); // Max 5 seconds
    console.log(`⏳ Processing delay: ${processingDelay}ms for ${recipients.length} emails`);
    
    if (processingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, processingDelay));
    }

    // For large lists (>1000), we'll store a lightweight preparation instead of full email objects
    // This prevents memory overflow and database timeout issues
    if (recipients.length > 1000) {
      console.log(`📦 LARGE LIST DETECTED: ${recipients.length} emails - using lightweight preparation`)
      
      // Store only the essential data needed for sending
      const lightweightPreparation = {
        recipientCount: recipients.length,
        recipients: recipients, // Store the parsed recipient list
        fromNames: fromNames,
        subjects: subjects,
        preparedAt: new Date().toISOString(),
        preparationType: 'lightweight'
      }

      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          status: 'prepared',
          prepared_emails: lightweightPreparation,
          total_recipients: recipients.length,
          error_message: null
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('❌ Failed to update campaign:', updateError)
        
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: `Failed to update campaign: ${updateError.message}`
          })
          .eq('id', campaignId)
        
        return new Response(
          JSON.stringify({ error: 'Failed to update campaign' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`✅ LIGHTWEIGHT PREPARATION COMPLETE: ${recipients.length} emails ready`)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Campaign prepared successfully with ${recipients.length} emails (lightweight mode)`,
          emailCount: recipients.length,
          preparationType: 'lightweight',
          preparationComplete: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // For smaller lists (<= 1000), prepare full email objects as before
    console.log(`🔧 PREPARING ${recipients.length} EMAILS (full preparation)...`);
    const preparedEmails = []
    
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      // Apply rotation logic
      const fromNameIndex = i % fromNames.length
      const subjectIndex = i % subjects.length
      
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

    console.log(`✅ FULL PREPARATION COMPLETE: ${preparedEmails.length} emails fully prepared`);

    // Update campaign with prepared emails
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        prepared_emails: preparedEmails,
        total_recipients: recipients.length,
        error_message: null
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Failed to update campaign:', updateError)
      
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Failed to update campaign: ${updateError.message}`
        })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to update campaign' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🎉 CAMPAIGN FULLY PREPARED: ${preparedEmails.length} emails ready for sending`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign prepared successfully with ${preparedEmails.length} emails`,
        emailCount: preparedEmails.length,
        preparationType: 'full',
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
