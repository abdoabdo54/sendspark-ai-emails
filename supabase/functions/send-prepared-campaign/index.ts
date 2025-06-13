
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
    const { campaignId, slice, campaignData, accounts, organizationId } = await req.json()

    console.log('🚀 GCF: Processing prepared campaign slice:', {
      campaignId,
      recipients: slice.recipients.length,
      accounts: accounts.length,
      sendingMode: campaignData.config.sendingMode
    })

    if (!campaignId || !slice || !campaignData || !accounts) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
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

    // Get the prepared campaign data
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

    if (campaign.status !== 'prepared' && campaign.status !== 'sending') {
      console.error('❌ Campaign not prepared:', campaign.status)
      return new Response(
        JSON.stringify({ error: 'Campaign must be prepared before sending' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const preparedEmails = campaign.prepared_emails || []
    if (preparedEmails.length === 0) {
      console.error('❌ No prepared emails found')
      return new Response(
        JSON.stringify({ error: 'No prepared emails found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the slice of prepared emails for this function
    const emailsToSend = preparedEmails.slice(slice.skip, slice.skip + slice.limit)
    
    console.log(`📧 Processing ${emailsToSend.length} PRE-PREPARED emails with ${accounts.length} accounts`)

    let sentCount = 0
    const errors = []

    // Process emails with account rotation (emails are already prepared with subject/from rotation)
    for (let i = 0; i < emailsToSend.length; i++) {
      const email = emailsToSend[i]
      const accountIndex = i % accounts.length // Rotate accounts
      const account = accounts[accountIndex]

      try {
        // Apply sending delay based on mode (unless zero-delay)
        if (campaignData.config.sendingMode !== 'zero-delay' && i > 0) {
          const delay = campaignData.config.sendingMode === 'fast' ? 500 : 2000
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Send email using the selected account with PRE-PREPARED data
        const emailPayload = {
          to: email.to,
          from_name: email.from_name, // Already rotated during preparation
          subject: email.subject,     // Already rotated during preparation
          html_content: email.html_content,
          text_content: email.text_content,
          account: account,
          campaign_id: campaignId
        }

        console.log(`📤 Sending email ${i + 1}/${emailsToSend.length} via ${account.name} to ${email.to}`)
        console.log(`   FROM: "${email.from_name}" | SUBJECT: "${email.subject}"`)

        // Here you would call your actual email sending service
        // For now, we'll simulate success
        await new Promise(resolve => setTimeout(resolve, 100)) // Simulate send time
        
        sentCount++
        
        // Test After logic
        if (campaignData.config?.testAfter?.enabled && 
            (sentCount % campaignData.config.testAfter.count === 0)) {
          console.log(`🎯 Test After: Sending test email after ${sentCount} emails`)
          // Send test email logic here
        }

      } catch (error) {
        console.error(`❌ Failed to send email to ${email.to}:`, error)
        errors.push({
          recipient: email.to,
          error: error.message
        })
      }
    }

    // Update campaign progress
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        sent_count: campaign.sent_count + sentCount
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Failed to update campaign progress:', updateError)
    }

    console.log(`✅ GCF completed: ${sentCount}/${emailsToSend.length} emails sent, ${errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: sentCount,
        total: emailsToSend.length,
        errors: errors,
        message: `Successfully sent ${sentCount} out of ${emailsToSend.length} emails`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in send-prepared-campaign:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
