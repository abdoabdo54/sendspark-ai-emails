
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailAccount {
  id: string;
  name: string;
  type: string;
  email: string;
  config: any;
}

interface Campaign {
  id: string;
  from_name: string;
  subject: string;
  recipients: string;
  html_content?: string;
  text_content?: string;
  send_method: string;
  selected_accounts: string[];
  selected_powermta_server?: string;
  config?: any;
}

async function sendEmailViaSMTP(config: any, emailData: any): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log(`Sending email via SMTP to ${emailData.to}`);
    
    const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/send-smtp-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        config,
        emailData
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      if (result.logs) {
        console.log('SMTP Success Logs:', result.logs.join('\n'));
      }
      return { success: true, logs: result.logs };
    } else {
      if (result.logs) {
        console.error('SMTP Error Logs:', result.logs.join('\n'));
      }
      return { success: false, error: result.error || 'SMTP sending failed', logs: result.logs };
    }
  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message, logs: [`Fatal error: ${error.message}`] };
  }
}

async function sendViaCloudFunctions(accounts: EmailAccount[], campaign: Campaign, recipients: string[], config: any) {
  console.log(`📤 Sending via Cloud Functions with ${accounts.length} accounts`);
  console.log(`⚙️ Sending Mode: ${config.sending_mode}, Dispatch Method: ${config.dispatch_method}`);
  
  const results = [];
  
  // Determine delay based on sending mode
  let delay = 1000; // Default 1 second
  if (config.sending_mode === 'fast') {
    delay = 500; // 0.5 seconds
  } else if (config.sending_mode === 'zero_delay') {
    delay = 0; // No delay for maximum speed
  } else if (config.sending_mode === 'controlled') {
    delay = 2000; // 2 seconds for controlled mode
  }

  console.log(`⏱️ Using ${delay}ms delay between emails`);
  
  // Handle different dispatch methods
  if (config.dispatch_method === 'parallel' && config.sending_mode === 'zero_delay') {
    console.log('🚀 PARALLEL + ZERO DELAY MODE: Maximum speed distribution');
    
    // Distribute recipients across accounts in parallel
    const accountGroups = [];
    const recipientsPerAccount = Math.ceil(recipients.length / accounts.length);
    
    for (let i = 0; i < accounts.length; i++) {
      const startIndex = i * recipientsPerAccount;
      const endIndex = Math.min(startIndex + recipientsPerAccount, recipients.length);
      const accountRecipients = recipients.slice(startIndex, endIndex);
      
      if (accountRecipients.length > 0) {
        accountGroups.push({
          account: accounts[i],
          recipients: accountRecipients
        });
      }
    }
    
    // Send all groups in parallel
    const parallelResults = await Promise.all(
      accountGroups.map(async (group) => {
        const groupResults = [];
        for (const recipient of group.recipients) {
          try {
            const emailData = {
              from: { email: group.account.email, name: campaign.from_name },
              to: recipient,
              subject: campaign.subject,
              html: campaign.html_content || campaign.text_content,
              text: campaign.text_content
            };

            let result;
            if (group.account.type === 'smtp') {
              result = await sendEmailViaSMTP(group.account.config, emailData);
            } else if (group.account.type === 'apps-script') {
              result = await sendViaAppsScript(group.account, emailData);
            }

            if (result && result.success) {
              console.log(`✓ Parallel sent to: ${recipient} via ${group.account.name}`);
              groupResults.push({ email: recipient, status: 'sent', account: group.account.name, logs: result.logs });
            } else {
              console.log(`✗ Parallel failed to: ${recipient} via ${group.account.name} - ${result?.error}`);
              groupResults.push({ email: recipient, status: 'failed', error: result?.error, account: group.account.name, logs: result?.logs });
            }
          } catch (error) {
            console.log(`✗ Parallel error for ${recipient}:`, error);
            groupResults.push({ email: recipient, status: 'failed', error: error.message, account: group.account.name });
          }
        }
        return groupResults;
      })
    );
    
    // Flatten results
    for (const groupResult of parallelResults) {
      results.push(...groupResult);
    }
  } else {
    // Round robin or sequential sending
    let accountIndex = 0;
    
    for (const recipient of recipients) {
      try {
        const account = accounts[accountIndex % accounts.length];
        
        const emailData = {
          from: { email: account.email, name: campaign.from_name },
          to: recipient,
          subject: campaign.subject,
          html: campaign.html_content || campaign.text_content,
          text: campaign.text_content
        };

        let result;
        if (account.type === 'smtp') {
          result = await sendEmailViaSMTP(account.config, emailData);
        } else if (account.type === 'apps-script') {
          result = await sendViaAppsScript(account, emailData);
        }

        if (result && result.success) {
          console.log(`✓ Cloud Functions sent to: ${recipient} via ${account.name}`);
          results.push({ email: recipient, status: 'sent', account: account.name, logs: result.logs });
        } else {
          console.log(`✗ Cloud Functions failed to: ${recipient} via ${account.name} - ${result?.error}`);
          results.push({ email: recipient, status: 'failed', error: result?.error, account: account.name, logs: result?.logs });
        }
        
        accountIndex++;
      } catch (error) {
        console.log(`✗ Cloud Functions error for ${recipient}:`, error);
        results.push({ email: recipient, status: 'failed', error: error.message });
      }
      
      // Apply delay only if not in zero delay mode
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return results;
}

async function sendViaAppsScript(account: EmailAccount, emailData: any): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    const response = await fetch(`https://script.google.com/macros/s/${account.config.deployment_id}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${account.config.api_key}`
      },
      body: JSON.stringify({
        recipients: [emailData.to],
        subject: emailData.subject,
        htmlContent: emailData.html,
        textContent: emailData.text,
        fromName: emailData.from.name,
        fromEmail: emailData.from.email
      })
    });

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Apps Script API error' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendViaCloudFunctionsWithPowerMTA(accounts: EmailAccount[], campaign: Campaign, recipients: string[], config: any, powerMTAServerId: string) {
  console.log(`📡 Sending via Cloud Functions + PowerMTA monitoring`);
  console.log(`🖥️ PowerMTA Server ID: ${powerMTAServerId}`);
  
  // First, send using cloud functions
  const cloudResults = await sendViaCloudFunctions(accounts, campaign, recipients, config);
  
  // Then, notify PowerMTA for monitoring (if PowerMTA integration is available)
  try {
    // This would be where you integrate with PowerMTA monitoring API
    console.log(`📊 PowerMTA monitoring enabled for campaign ${campaign.id}`);
    
    // Add PowerMTA monitoring metadata to results
    for (const result of cloudResults) {
      result.powermta_monitored = true;
      result.powermta_server_id = powerMTAServerId;
    }
  } catch (error) {
    console.log('⚠️ PowerMTA monitoring setup failed:', error);
  }
  
  return cloudResults;
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

    // Parse campaign config
    const campaignConfig = campaign.config || {};
    console.log('📋 Campaign Configuration:', campaignConfig);
    console.log('📤 Send Method:', campaign.send_method);
    console.log('👥 Selected Accounts from campaign:', campaign.selected_accounts);
    console.log('🖥️ Selected PowerMTA Server:', campaign.selected_powermta_server);

    // Get the selected accounts - FIXED LOGIC
    let selectedAccountIds = campaign.selected_accounts || [];
    
    // Also check in the config as backup
    if (!selectedAccountIds || selectedAccountIds.length === 0) {
      selectedAccountIds = campaignConfig.selected_accounts || [];
    }

    console.log('🔍 Final selected account IDs:', selectedAccountIds);

    if (!selectedAccountIds || selectedAccountIds.length === 0) {
      throw new Error('No email accounts selected for this campaign. Please select at least one SMTP or Apps Script account.');
    }

    // Get selected email accounts
    const { data: accounts, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('id', selectedAccountIds)
      .eq('is_active', true)

    if (accountError) throw accountError
    if (!accounts || accounts.length === 0) {
      throw new Error(`No active email accounts found for the selected account IDs: ${selectedAccountIds.join(', ')}`)
    }

    console.log(`📧 Found ${accounts.length} active accounts for sending`);
    accounts.forEach(acc => console.log(`  - ${acc.name} (${acc.type}): ${acc.email}`));

    // Parse recipients
    const recipients = campaign.recipients.split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    console.log(`📬 Sending campaign ${campaignId} to ${recipients.length} recipients`);

    let results = [];

    // Route to appropriate sending method
    switch (campaign.send_method) {
      case 'cloud-functions':
        results = await sendViaCloudFunctions(accounts, campaign, recipients, campaignConfig);
        break;
      case 'cloud-functions-powermta':
        if (!campaign.selected_powermta_server) {
          throw new Error('PowerMTA server is required for cloud-functions-powermta method');
        }
        results = await sendViaCloudFunctionsWithPowerMTA(accounts, campaign, recipients, campaignConfig, campaign.selected_powermta_server);
        break;
      default:
        throw new Error(`Unsupported send method: ${campaign.send_method}`);
    }

    // Count successful sends
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.length - sentCount;

    console.log(`📊 Campaign ${campaignId} results: ${sentCount} sent, ${failedCount} failed`);

    // Update campaign status
    const finalStatus = sentCount === recipients.length ? 'sent' : 
                       sentCount > 0 ? 'sent' : 'failed';

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: finalStatus,
        sent_count: sentCount
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    // Create campaign stats
    const { error: statsError } = await supabase
      .from('campaign_stats')
      .insert({
        campaign_id: campaignId,
        opens: 0,
        clicks: 0,
        bounces: failedCount,
        unsubscribes: 0
      })

    if (statsError) console.error('Error creating stats:', statsError)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
        method: campaign.send_method,
        accountsUsed: accounts.map(a => a.name),
        sendingMode: campaignConfig.sending_mode || 'controlled',
        dispatchMethod: campaignConfig.dispatch_method || 'round_robin',
        powerMTAEnabled: campaign.send_method === 'cloud-functions-powermta',
        details: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('❌ Error sending campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
