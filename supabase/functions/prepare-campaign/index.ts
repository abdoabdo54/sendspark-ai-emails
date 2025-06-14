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

    // FIXED: Parse rotation configuration using LINE-BY-LINE format
    const config = campaign.config || {}
    
    // Parse from names - EACH LINE is a separate from name
    let fromNames = [campaign.from_name]; // Default fallback
    if (config.rotation?.useFromNameRotation && config.rotation.fromNames) {
      const fromNamesText = config.rotation.fromNames;
      if (typeof fromNamesText === 'string' && fromNamesText.trim()) {
        fromNames = fromNamesText
          .split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0);
      } else if (Array.isArray(fromNamesText) && fromNamesText.length > 0) {
        fromNames = fromNamesText;
      }
    }
    
    // Parse subjects - EACH LINE is a separate subject
    let subjects = [campaign.subject]; // Default fallback
    if (config.rotation?.useSubjectRotation && config.rotation.subjects) {
      const subjectsText = config.rotation.subjects;
      if (typeof subjectsText === 'string' && subjectsText.trim()) {
        subjects = subjectsText
          .split('\n')
          .map(subject => subject.trim())
          .filter(subject => subject.length > 0);
      } else if (Array.isArray(subjectsText) && subjectsText.length > 0) {
        subjects = subjectsText;
      }
    }

    console.log('🔄 Using rotation:', {
      fromNamesCount: fromNames.length,
      subjectsCount: subjects.length,
      fromNames: fromNames.slice(0, 3), // Show first 3 for debugging
      subjects: subjects.slice(0, 3)    // Show first 3 for debugging
    })

    // Add processing delay based on list size
    const processingDelay = Math.min(recipients.length * 10, 3000); // 10ms per email, max 3 seconds
    console.log(`⏳ Processing ${recipients.length} emails with ${processingDelay}ms delay`);
    
    if (processingDelay > 100) {
      await new Promise(resolve => setTimeout(resolve, processingDelay));
    }

    // FIXED: Create proper prepared emails array with PERFECT ROTATION & NO CONTENT
    const preparedEmails = recipients.map((email, index) => {
      // Perfect rotation: each email gets next from name and subject in sequence
      const fromNameIndex = index % fromNames.length;
      const subjectIndex = index % subjects.length;
      
      return {
        to: email,
        from_name: fromNames[fromNameIndex],
        subject: subjects[subjectIndex],
        // html_content and text_content are removed to fix memory limit errors.
        // They will be sourced from the parent campaign during the sending phase.
        prepared_at: new Date().toISOString(),
        rotation_index: index // Track rotation for debugging
      };
    });

    console.log(`✅ PREPARATION OPTIMIZED: ${recipients.length} emails processed without content duplication.`);
    console.log(`📧 Sample prepared emails (optimized):`, preparedEmails.slice(0, 3));

    // Update campaign with prepared emails array
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

    console.log(`🎉 SUCCESS: Campaign prepared with ${recipients.length} emails and perfect rotation`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign prepared successfully with ${recipients.length} emails`,
        emailCount: recipients.length,
        preparationComplete: true,
        rotationInfo: {
          fromNamesUsed: fromNames.length,
          subjectsUsed: subjects.length
        }
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
