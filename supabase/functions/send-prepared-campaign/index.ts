
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

    console.log('🚀 Campaign Send Request:', {
      campaignId,
      recipients: slice.recipients?.length || 0,
      accounts: accounts?.length || 0,
      globalStartIndex
    })

    if (!campaignId || !slice?.recipients || !campaignData || !accounts || accounts.length === 0) {
      console.error('❌ Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`📧 Processing ${slice.recipients.length} recipients with ${accounts.length} accounts`)

    let sentCount = 0
    const errors = []
    const logs = []

    // Process emails with account rotation
    for (let i = 0; i < slice.recipients.length; i++) {
      const recipient = slice.recipients[i]
      const accountIndex = i % accounts.length
      const account = accounts[accountIndex]

      try {
        console.log(`📤 Sending email ${i + 1}/${slice.recipients.length} via ${account.name} (${account.type}) to ${recipient}`)

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
              account: account.name,
              type: 'smtp'
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
              account: account.name,
              type: 'apps-script'
            })
          }
        } else {
          const errorMsg = `Unsupported account type: ${account.type}`
          logs.push(`⚠️ ${errorMsg}`)
          errors.push({
            recipient,
            error: errorMsg,
            account: account.name,
            type: account.type
          })
        }
        
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipient}:`, error)
        logs.push(`❌ Failed to send to ${recipient}: ${error.message}`)
        errors.push({
          recipient,
          error: error.message,
          account: account?.name || 'unknown',
          type: account?.type || 'unknown'
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

    console.log(`✅ Campaign completed: ${sentCount}/${slice.recipients.length} emails sent, ${errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: sentCount,
        total: slice.recipients.length,
        errors: errors,
        logs: logs.slice(-10), // Last 10 logs
        message: `Successfully sent ${sentCount} out of ${slice.recipients.length} emails`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in send-prepared-campaign:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Map configuration properly for different SMTP providers
    const smtpConfig = {
      host: account.config?.host,
      port: parseInt(account.config?.port) || 587,
      username: account.config?.username || account.config?.user,
      password: account.config?.password || account.config?.pass,
      encryption: account.config?.security || account.config?.encryption || 'tls',
      auth_required: account.config?.use_auth !== false && account.config?.auth_required !== false
    }

    console.log(`🔧 SMTP Config for ${account.name}:`, {
      host: smtpConfig.host,
      port: smtpConfig.port,
      encryption: smtpConfig.encryption,
      auth_required: smtpConfig.auth_required,
      username: smtpConfig.username ? '***' : 'missing'
    })

    const response = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        config: smtpConfig,
        emailData
      })
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      return { success: true }
    } else {
      console.error('❌ SMTP Error Response:', result)
      return { success: false, error: result.error || 'SMTP sending failed' }
    }
  } catch (error) {
    console.error('❌ SMTP sending error:', error)
    return { success: false, error: error.message }
  }
}

async function sendViaAppsScript(account: any, recipient: string, campaignData: any): Promise<{ success: boolean; error?: string }> {
  try {
    const config = account.config || {};
    const scriptUrl = config.exec_url || config.script_url;
    
    if (!scriptUrl) {
      return { success: false, error: 'Apps Script URL not configured' }
    }

    console.log(`📧 Sending via Apps Script: ${scriptUrl}`)

    const payload = {
      to: recipient,
      subject: campaignData.subject,
      htmlBody: campaignData.html_content || '',
      plainBody: campaignData.text_content || '',
      fromName: campaignData.from_name,
      fromAlias: account.email
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.api_key ? { 'Authorization': `Bearer ${config.api_key}` } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000) // 45 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Apps Script HTTP error:`, response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const result = await response.json()
    console.log(`📧 Apps Script response:`, result)
    
    if (result.status === 'success' || result.success === true || result.result === 'success') {
      return { success: true }
    } else {
      return { success: false, error: result.message || result.error || result.details || 'Apps Script error' }
    }
  } catch (error) {
    console.error('❌ Apps Script sending error:', error)
    return { success: false, error: error.message }
  }
}
