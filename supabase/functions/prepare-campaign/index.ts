
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

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) throw campaignError

    if (campaign.status !== 'draft') {
      throw new Error('Campaign must be in draft status to prepare')
    }

    // Parse recipients
    const recipients = campaign.recipients.split(',').map((email: string) => email.trim()).filter(Boolean)
    
    if (recipients.length === 0) {
      throw new Error('No valid recipients found')
    }

    console.log(`Preparing campaign ${campaignId} for ${recipients.length} recipients`);

    // Prepare personalized emails
    const preparedEmails = recipients.map((email: string) => {
      let personalizedHtml = campaign.html_content || '';
      let personalizedText = campaign.text_content || '';
      let personalizedSubject = campaign.subject || '';

      // Add tracking pixel for opens
      const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-open?campaign=${campaignId}&email=${encodeURIComponent(email)}" width="1" height="1" style="display:none;" alt="" />`;
      
      // Add unsubscribe link
      const unsubscribeLink = `${supabaseUrl}/functions/v1/track-unsubscribe?campaign=${campaignId}&email=${encodeURIComponent(email)}`;
      const unsubscribeHtml = `<div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        <a href="${unsubscribeLink}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from these emails</a>
      </div>`;

      // Basic personalization - replace common placeholders
      const personalizations = {
        '{email}': email,
        '{firstname}': email.split('@')[0], // Simple fallback
        '{lastname}': '',
        '{company}': email.split('@')[1]?.split('.')[0] || ''
      };

      // Apply personalizations
      for (const [placeholder, value] of Object.entries(personalizations)) {
        personalizedHtml = personalizedHtml.replace(new RegExp(placeholder, 'gi'), value);
        personalizedText = personalizedText.replace(new RegExp(placeholder, 'gi'), value);
        personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'gi'), value);
      }

      // Add tracking and unsubscribe to HTML
      if (personalizedHtml) {
        // Add tracking pixel before closing body tag, or at the end if no body tag
        if (personalizedHtml.includes('</body>')) {
          personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`);
        } else {
          personalizedHtml += trackingPixel;
        }

        // Add unsubscribe link before closing body tag, or at the end if no body tag
        if (personalizedHtml.includes('</body>')) {
          personalizedHtml = personalizedHtml.replace('</body>', `${unsubscribeHtml}</body>`);
        } else {
          personalizedHtml += unsubscribeHtml;
        }
      }

      // Add unsubscribe to text version
      if (personalizedText) {
        personalizedText += `\n\nTo unsubscribe from these emails, visit: ${unsubscribeLink}`;
      }

      return {
        to: email,
        from: campaign.from_name,
        subject: personalizedSubject,
        html: personalizedHtml,
        text: personalizedText,
        campaignId: campaignId
      };
    });

    // Update campaign with prepared emails and status
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        prepared_emails: preparedEmails,
        total_recipients: recipients.length
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    console.log(`Campaign ${campaignId} prepared successfully with ${preparedEmails.length} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Campaign prepared successfully',
        totalEmails: preparedEmails.length,
        campaignId: campaignId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error preparing campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
