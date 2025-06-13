
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

    console.log('🔧 CAMPAIGN PREPARATION: Starting for campaign:', campaignId)

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

    // Allow preparation for any status except 'sending'
    if (campaign.status === 'sending') {
      console.error('❌ Cannot prepare campaign while sending')
      return new Response(
        JSON.stringify({ error: 'Cannot prepare campaign while it is being sent' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📧 Preparing campaign:', {
      id: campaignId,
      subject: campaign.subject,
      status: campaign.status,
      recipientsLength: campaign.recipients?.length || 0
    })

    // Parse recipients from different formats
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

    console.log(`📊 FOUND ${recipients.length} valid recipients`);
    
    if (recipients.length === 0) {
      console.error('❌ No valid recipients found');
      
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

    console.log('🔄 Using rotation:', {
      fromNamesCount: fromNames.length,
      subjectsCount: subjects.length
    })

    // Add processing delay based on list size
    const processingDelay = Math.min(recipients.length * 10, 3000); // 10ms per email, max 3 seconds
    console.log(`⏳ Processing ${recipients.length} emails with ${processingDelay}ms delay`);
    
    if (processingDelay > 100) {
      await new Promise(resolve => setTimeout(resolve, processingDelay));
    }

    // NEW APPROACH: Store preparation metadata instead of individual emails
    // This avoids JSON size limits and memory issues
    const preparationData = {
      totalRecipients: recipients.length,
      recipientList: recipients, // Store the parsed list
      fromNames: fromNames,
      subjects: subjects,
      preparedAt: new Date().toISOString(),
      preparationMethod: recipients.length > 500 ? 'batch' : 'individual'
    }

    console.log(`✅ PREPARATION COMPLETE: ${recipients.length} emails processed using ${preparationData.preparationMethod} method`);

    // Update campaign with preparation data
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        prepared_emails: preparationData,
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
          error_message: `Preparation update failed: ${updateError.message}`
        })
        .eq('id', campaignId)
      
      return new Response(
        JSON.stringify({ error: 'Failed to save preparation data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🎉 SUCCESS: Campaign prepared with ${recipients.length} emails`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign prepared successfully with ${recipients.length} emails`,
        emailCount: recipients.length,
        preparationMethod: preparationData.preparationMethod,
        preparationComplete: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ PREPARATION ERROR:', error)
    return new Response(
      JSON.stringify({ error: 'Preparation failed', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
