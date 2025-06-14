
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
    const { campaignId, slice, campaignData, accounts, organizationId, globalStartIndex } = await req.json()

    console.log('🚀 GCF: Processing campaign slice:', {
      campaignId,
      recipients: slice.recipients?.length || 0,
      accounts: accounts?.length || 0,
      sendingMode: campaignData?.config?.sendingMode || 'unknown',
      globalStartIndex
    })

    if (!campaignId || !slice?.recipients || !campaignData || !accounts || accounts.length === 0) {
      console.error('❌ Missing required parameters:', { 
        campaignId: !!campaignId, 
        recipients: slice?.recipients?.length || 0, 
        campaignData: !!campaignData, 
        accounts: accounts?.length || 0 
      })
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

    console.log(`📧 Processing ${slice.recipients.length} recipients with ${accounts.length} accounts`)

    let sentCount = 0
    const errors = []
    const logs = []

    // Process emails with account rotation and proper sending
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i]
      const accountIndex = i % accounts.length // Rotate accounts
      const account = accounts[accountIndex]

      try {
        // Apply sending delay based on mode (unless zero-delay)
        if (campaignData.config?.sendingMode !== 'zero-delay' && i > 0) {
          const delay = campaignData.config?.sendingMode === 'fast' ? 500 : 2000
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        console.log(`📤 Sending email ${i + 1}/${slice.recipients.length} via ${account.name} to ${recipient}`)

        // Send email based on account type
        if (account.type === 'smtp') {
          const smtpResult = await sendViaSMTP(account, recipient, campaignData)
          
          if (smtpResult.success) {
            sentCount++
            logs.push(`✅ SMTP sent to ${recipient} via ${account.name}`)
            console.log(`✅ SMTP sent to ${recipient} via ${account.name}`)
          } else {
            logs.push(`❌ SMTP failed to ${recipient}: ${smtpResult.error}`)
            console.error(`❌ SMTP failed to ${recipient}:`, smtpResult.error)
            errors.push({
              recipient,
              error: smtpResult.error,
              account: account.name
            })
          }
        } else if (account.type === 'apps-script') {
          const appsScriptResult = await sendViaAppsScript(account, recipient, campaignData)
          
          if (appsScriptResult.success) {
            sentCount++
            logs.push(`✅ Apps Script sent to ${recipient} via ${account.name}`)
            console.log(`✅ Apps Script sent to ${recipient} via ${account.name}`)
          } else {
            logs.push(`❌ Apps Script failed to ${recipient}: ${appsScriptResult.error}`)
            console.error(`❌ Apps Script failed to ${recipient}:`, appsScriptResult.error)
            errors.push({
              recipient,
              error: appsScriptResult.error,
              account: account.name
            })
          }
        } else {
          logs.push(`⚠️ Unsupported account type: ${account.type}`)
          errors.push({
            recipient,
            error: `Unsupported account type: ${account.type}`,
            account: account.name
          })
        }
        
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipient}:`, error)
        logs.push(`❌ Failed to send to ${recipient}: ${error.message}`)
        errors.push({
          recipient,
          error: error.message,
          account: account?.name || 'unknown'
        })
      }
    }

    // Update campaign progress
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        sent_count: supabase.sql`sent_count + ${sentCount}`
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('❌ Failed to update campaign progress:', updateError)
    }

    console.log(`✅ GCF completed: ${sentCount}/${slice.recipients.length} emails sent, ${errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: sentCount,
        total: slice.recipients.length,
        errors: errors,
        logs: logs,
        message: `Successfully sent ${sentCount} out of ${slice.recipients.length} emails`
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

async function sendViaSMTP(account: any, recipient: string, campaignData: any): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const emailData = {
      from: { email: account.email, name: campaignData.from_name },
      to: recipient,
      subject: campaignData.subject,
      html: campaignData.html_content || campaignData.text_content,
      text: campaignData.text_content || ''
    }

    console.log(`🔧 SMTP Config for ${account.name}:`, {
      host: account.config?.host,
      port: account.config?.port,
      encryption: account.config?.security || account.config?.encryption,
      username: account.config?.username ? '***' : 'missing'
    })

    const response = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        config: {
          host: account.config?.host,
          port: account.config?.port || 587,
          username: account.config?.username,
          password: account.config?.password,
          encryption: account.config?.security || account.config?.encryption || 'tls',
          auth_required: account.config?.use_auth !== false
        },
        emailData
      })
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      return { success: true }
    } else {
      console.error('SMTP Error Response:', result)
      return { success: false, error: result.error || 'SMTP sending failed' }
    }
  } catch (error) {
    console.error('SMTP sending error:', error)
    return { success: false, error: error.message }
  }
}

async function sendViaAppsScript(account: any, recipient: string, campaignData: any): Promise<{ success: boolean; error?: string }> {
  try {
    const scriptUrl = account.config?.script_url
    
    if (!scriptUrl) {
      return { success: false, error: 'Apps Script URL not configured' }
    }

    console.log(`📧 Sending via Apps Script: ${scriptUrl}`)

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: recipient,
        subject: campaignData.subject,
        htmlBody: campaignData.html_content || '',
        plainBody: campaignData.text_content || '',
        fromName: campaignData.from_name,
        fromAlias: account.email
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Apps Script HTTP error:`, response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const result = await response.json()
    console.log(`📧 Apps Script response:`, result)
    
    if (result.status === 'success' || result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.message || result.error || 'Apps Script error' }
    }
  } catch (error) {
    console.error('Apps Script sending error:', error)
    return { success: false, error: error.message }
  }
}
