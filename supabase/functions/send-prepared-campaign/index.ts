
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmailViaSMTP(config: any, emailData: any): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log(`Sending email via SMTP to ${emailData.to}`);
    
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-smtp-email`, {
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
      return { success: true, logs: result.logs };
    } else {
      return { success: false, error: result.error || 'SMTP sending failed', logs: result.logs };
    }
  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message, logs: [`Fatal error: ${error.message}`] };
  }
}

async function sendEmailViaAppsScript(config: any, emailData: any): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log(`Sending email via Apps Script to ${emailData.to}`);
    
    if (!config.exec_url) {
      throw new Error('Apps Script execution URL is required');
    }
    
    const payload = {
      to: emailData.to,
      subject: emailData.subject,
      htmlBody: emailData.html,
      plainBody: emailData.text || '',
      fromName: emailData.from?.name || '',
      fromAlias: emailData.from?.email || '',
      cc: emailData.cc || '',
      bcc: emailData.bcc || ''
    };

    console.log('Sending to Apps Script:', config.exec_url);

    const response = await fetch(config.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success') {
        console.log('✓ Apps Script sent successfully');
        return { 
          success: true, 
          logs: [`✓ Email sent via Apps Script to ${emailData.to}`, `Remaining quota: ${result.remainingQuota || 'Unknown'}`]
        };
      } else {
        console.error('✗ Apps Script error:', result.message);
        return { 
          success: false, 
          error: result.message || 'Apps Script sending failed',
          logs: [`✗ Apps Script error: ${result.message}`]
        };
      }
    } else {
      const errorText = await response.text();
      console.error('✗ Apps Script HTTP error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}`,
        logs: [`✗ Apps Script HTTP error: ${response.status} - ${errorText}`]
      };
    }
  } catch (error) {
    console.error('Apps Script sending error:', error);
    return { 
      success: false, 
      error: error.message,
      logs: [`✗ Apps Script fatal error: ${error.message}`]
    };
  }
}

function calculateDelay(accountType: string, emailsPerHour: number = 60): number {
  // Convert emails per hour to delay in milliseconds
  const delayMs = (60 * 60 * 1000) / emailsPerHour;
  
  // Minimum delays by account type
  const minimumDelays = {
    'smtp': 2000,        // 2 seconds minimum
    'apps-script': 1000,  // 1 second minimum
    'powermta': 500      // 0.5 seconds minimum
  };

  return Math.max(delayMs, minimumDelays[accountType] || 2000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId, startIndex = 0, emailsPerHour = 60, batchSize = 10 } = await req.json()

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

    if (campaign.status !== 'prepared' && campaign.status !== 'sending' && campaign.status !== 'paused') {
      throw new Error('Campaign must be prepared before sending')
    }

    const preparedEmails = campaign.prepared_emails || [];
    if (preparedEmails.length === 0) {
      throw new Error('No prepared emails found for this campaign')
    }

    // Calculate which emails to send in this batch
    const endIndex = Math.min(startIndex + batchSize, preparedEmails.length);
    const emailsToSend = preparedEmails.slice(startIndex, endIndex);

    console.log(`Sending batch ${startIndex}-${endIndex-1} of ${preparedEmails.length} emails for campaign ${campaignId}`);

    // Update campaign status to sending if not already
    if (campaign.status !== 'sending') {
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);
    }

    const results = [];
    let sentCount = campaign.sent_count || 0;
    const delay = calculateDelay(emailsToSend[0]?.accountType || 'smtp', emailsPerHour);

    // Send emails in this batch
    for (const preparedEmail of emailsToSend) {
      try {
        const emailData = {
          from: { email: preparedEmail.fromEmail, name: preparedEmail.fromName },
          to: preparedEmail.recipient,
          subject: preparedEmail.subject,
          html: preparedEmail.htmlContent,
          text: preparedEmail.textContent
        };

        // Send based on account type
        let result;
        if (preparedEmail.accountType === 'smtp') {
          result = await sendEmailViaSMTP(preparedEmail.accountConfig, emailData);
        } else if (preparedEmail.accountType === 'apps-script') {
          result = await sendEmailViaAppsScript(preparedEmail.accountConfig, emailData);
        } else {
          result = { 
            success: false, 
            error: `Account type ${preparedEmail.accountType} not supported`,
            logs: [`✗ Unsupported account type: ${preparedEmail.accountType}`]
          };
        }
        
        if (result.success) {
          console.log(`✓ Email sent to: ${preparedEmail.recipient} via ${preparedEmail.accountType}`);
          results.push({ email: preparedEmail.recipient, status: 'sent', accountType: preparedEmail.accountType });
          sentCount++;
        } else {
          console.log(`✗ Email failed to: ${preparedEmail.recipient} - ${result.error}`);
          results.push({ email: preparedEmail.recipient, status: 'failed', error: result.error, accountType: preparedEmail.accountType });
        }

        // Mark email as processed in the prepared emails array
        preparedEmail.status = result.success ? 'sent' : 'failed';
        preparedEmail.sentAt = new Date().toISOString();
        if (result.error) {
          preparedEmail.error = result.error;
        }

      } catch (error) {
        console.log(`✗ Error for ${preparedEmail.recipient}:`, error);
        results.push({ email: preparedEmail.recipient, status: 'failed', error: error.message });
        preparedEmail.status = 'failed';
        preparedEmail.error = error.message;
      }
      
      // Add delay between emails for rate limiting
      if (preparedEmail !== emailsToSend[emailsToSend.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Update campaign with new sent count and updated prepared emails
    const isComplete = endIndex >= preparedEmails.length;
    const finalStatus = isComplete ? 
      (sentCount === preparedEmails.length ? 'sent' : 'sent') : 
      'sending';

    await supabase
      .from('email_campaigns')
      .update({
        sent_count: sentCount,
        status: finalStatus,
        prepared_emails: preparedEmails,
        ...(isComplete && { sent_at: new Date().toISOString() })
      })
      .eq('id', campaignId);

    // If not complete, schedule next batch
    const shouldContinue = !isComplete && endIndex < preparedEmails.length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentInBatch: results.filter(r => r.status === 'sent').length,
        failedInBatch: results.filter(r => r.status === 'failed').length,
        totalSent: sentCount,
        totalRecipients: preparedEmails.length,
        isComplete,
        nextStartIndex: shouldContinue ? endIndex : null,
        progress: Math.round((sentCount / preparedEmails.length) * 100),
        delay: delay,
        emailsPerHour,
        details: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error sending prepared campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
