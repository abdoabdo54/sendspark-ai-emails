
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailJob {
  id: string;
  organization_id: string;
  recipient_email: string;
  recipient_data: any;
  from_name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  custom_headers: any;
  account_id?: string;
  status: string;
  retry_count: number;
  queue_id?: string;
}

interface EmailAccount {
  id: string;
  name: string;
  type: string;
  email: string;
  config: any;
  rate_limit_emails_per_hour: number;
  rate_limit_emails_per_day: number;
  rate_limit_delay_seconds: number;
}

interface SendingQueue {
  id: string;
  max_concurrent_sends: number;
  status: string;
}

async function checkRateLimit(supabase: any, accountId: string, account: EmailAccount): Promise<boolean> {
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get current rate limiting data
  const { data: rateLimitData } = await supabase
    .from('rate_limiting_logs')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (!rateLimitData) {
    // Create initial rate limit record
    await supabase
      .from('rate_limiting_logs')
      .insert({
        account_id: accountId,
        emails_sent_this_hour: 0,
        emails_sent_this_day: 0,
        hour_window_start: hourStart.toISOString(),
        day_window_start: dayStart.toISOString()
      });
    return true;
  }

  // Check if we need to reset hourly counter
  const currentHourStart = new Date(rateLimitData.hour_window_start);
  if (hourStart > currentHourStart) {
    await supabase
      .from('rate_limiting_logs')
      .update({
        emails_sent_this_hour: 0,
        hour_window_start: hourStart.toISOString()
      })
      .eq('account_id', accountId);
    rateLimitData.emails_sent_this_hour = 0;
  }

  // Check if we need to reset daily counter
  const currentDayStart = new Date(rateLimitData.day_window_start);
  if (dayStart > currentDayStart) {
    await supabase
      .from('rate_limiting_logs')
      .update({
        emails_sent_this_day: 0,
        day_window_start: dayStart.toISOString()
      })
      .eq('account_id', accountId);
    rateLimitData.emails_sent_this_day = 0;
  }

  // Check rate limits
  if (rateLimitData.emails_sent_this_hour >= account.rate_limit_emails_per_hour) {
    console.log(`Rate limit exceeded for account ${accountId}: ${rateLimitData.emails_sent_this_hour}/${account.rate_limit_emails_per_hour} per hour`);
    return false;
  }

  if (rateLimitData.emails_sent_this_day >= account.rate_limit_emails_per_day) {
    console.log(`Rate limit exceeded for account ${accountId}: ${rateLimitData.emails_sent_this_day}/${account.rate_limit_emails_per_day} per day`);
    return false;
  }

  return true;
}

async function incrementRateLimit(supabase: any, accountId: string) {
  await supabase
    .from('rate_limiting_logs')
    .update({
      emails_sent_this_hour: supabase.raw('emails_sent_this_hour + 1'),
      emails_sent_this_day: supabase.raw('emails_sent_this_day + 1'),
      last_email_sent_at: new Date().toISOString()
    })
    .eq('account_id', accountId);
}

async function sendEmailViaSMTP(config: any, emailData: any): Promise<{ success: boolean; error?: string }> {
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
    return { success: response.ok && result.success, error: result.error };
  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message };
  }
}

async function sendViaAppsScript(account: EmailAccount, job: EmailJob): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Sending via Apps Script: ${account.config.script_id}`);
    
    const response = await fetch(`https://script.google.com/macros/s/${account.config.deployment_id}/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${account.config.api_key}`
      },
      body: JSON.stringify({
        recipients: [job.recipient_email],
        subject: job.subject,
        htmlContent: job.html_content,
        textContent: job.text_content,
        fromName: job.from_name,
        fromEmail: account.email,
        customHeaders: job.custom_headers
      })
    });

    if (response.ok) {
      console.log(`✓ Apps Script sent to: ${job.recipient_email}`);
      return { success: true };
    } else {
      const error = `Apps Script API error: ${response.status}`;
      console.log(`✗ ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`✗ Apps Script error:`, error);
    return { success: false, error: error.message };
  }
}

async function sendViaPowerMTA(account: EmailAccount, job: EmailJob): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Sending via PowerMTA: ${account.config.server_host}`);
    
    const response = await fetch(`http://${account.config.server_host}:${account.config.api_port}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${account.config.username}:${account.config.password}`)}`
      },
      body: JSON.stringify({
        recipients: [job.recipient_email],
        subject: job.subject,
        html_content: job.html_content,
        text_content: job.text_content,
        from_name: job.from_name,
        from_email: account.email,
        virtual_mta: account.config.virtual_mta,
        job_pool: account.config.job_pool,
        custom_headers: job.custom_headers
      })
    });

    if (response.ok) {
      console.log(`✓ PowerMTA sent to: ${job.recipient_email}`);
      return { success: true };
    } else {
      const error = `PowerMTA API error: ${response.status}`;
      console.log(`✗ ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`✗ PowerMTA error:`, error);
    return { success: false, error: error.message };
  }
}

async function processEmailJob(supabase: any, job: EmailJob): Promise<void> {
  try {
    // Mark job as sending
    await supabase
      .from('email_jobs')
      .update({ status: 'sending' })
      .eq('id', job.id);

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', job.account_id)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${job.account_id}`);
    }

    // Check rate limits
    const canSend = await checkRateLimit(supabase, account.id, account);
    if (!canSend) {
      // Put job back to pending for later processing
      await supabase
        .from('email_jobs')
        .update({ status: 'pending' })
        .eq('id', job.id);
      return;
    }

    // Apply rate limiting delay
    if (account.rate_limit_delay_seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, account.rate_limit_delay_seconds * 1000));
    }

    let result;
    
    // Send based on account type
    switch (account.type) {
      case 'smtp':
        const emailData = {
          from: { email: account.email, name: job.from_name },
          to: job.recipient_email,
          subject: job.subject,
          html: job.html_content || job.text_content,
          text: job.text_content,
          customHeaders: job.custom_headers
        };
        result = await sendEmailViaSMTP(account.config, emailData);
        break;
        
      case 'apps-script':
        result = await sendViaAppsScript(account, job);
        break;
        
      case 'powermta':
        result = await sendViaPowerMTA(account, job);
        break;
        
      default:
        throw new Error(`Unsupported account type: ${account.type}`);
    }

    if (result.success) {
      // Mark as sent and increment rate limit
      await supabase
        .from('email_jobs')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await incrementRateLimit(supabase, account.id);
      console.log(`✓ Email sent successfully: ${job.recipient_email}`);
    } else {
      // Mark as failed with error
      await supabase
        .from('email_jobs')
        .update({ 
          status: 'failed',
          error_message: result.error,
          retry_count: job.retry_count + 1
        })
        .eq('id', job.id);
      
      console.log(`✗ Email failed: ${job.recipient_email} - ${result.error}`);
    }

  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    
    // Mark as failed
    await supabase
      .from('email_jobs')
      .update({ 
        status: 'failed',
        error_message: error.message,
        retry_count: job.retry_count + 1
      })
      .eq('id', job.id);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { queueId } = await req.json()

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`Processing email queue: ${queueId}`)

    // Get queue details
    const { data: queue, error: queueError } = await supabase
      .from('sending_queues')
      .select('*')
      .eq('id', queueId)
      .single()

    if (queueError || !queue) {
      throw new Error(`Queue not found: ${queueId}`)
    }

    if (queue.status !== 'running') {
      console.log(`Queue ${queueId} is not in running status: ${queue.status}`)
      return new Response(
        JSON.stringify({ message: `Queue is ${queue.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get pending jobs for this queue
    const { data: jobs, error: jobsError } = await supabase
      .from('email_jobs')
      .select('*')
      .eq('queue_id', queueId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(queue.max_concurrent_sends)

    if (jobsError) throw jobsError

    if (!jobs || jobs.length === 0) {
      console.log(`No pending jobs found for queue ${queueId}`)
      
      // Check if all jobs are completed
      const { data: allJobs } = await supabase
        .from('email_jobs')
        .select('status')
        .eq('queue_id', queueId)

      const pendingCount = allJobs?.filter(j => j.status === 'pending').length || 0
      const sendingCount = allJobs?.filter(j => j.status === 'sending').length || 0
      
      if (pendingCount === 0 && sendingCount === 0) {
        // Mark queue as completed
        await supabase
          .from('sending_queues')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', queueId)
        
        console.log(`Queue ${queueId} completed`)
      }

      return new Response(
        JSON.stringify({ message: 'No pending jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${jobs.length} jobs from queue ${queueId}`)

    // Process jobs concurrently
    const processingPromises = jobs.map(job => processEmailJob(supabase, job))
    await Promise.allSettled(processingPromises)

    // Update queue statistics
    const { data: queueStats } = await supabase
      .from('email_jobs')
      .select('status')
      .eq('queue_id', queueId)

    const completedJobs = queueStats?.filter(j => j.status === 'sent').length || 0
    const failedJobs = queueStats?.filter(j => j.status === 'failed').length || 0

    await supabase
      .from('sending_queues')
      .update({ 
        completed_jobs: completedJobs,
        failed_jobs: failedJobs
      })
      .eq('id', queueId)

    // Schedule next batch if there are more pending jobs
    const { data: remainingJobs } = await supabase
      .from('email_jobs')
      .select('id')
      .eq('queue_id', queueId)
      .eq('status', 'pending')
      .limit(1)

    if (remainingJobs && remainingJobs.length > 0) {
      // Schedule next batch processing with a small delay
      setTimeout(async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ queueId })
          })
        } catch (error) {
          console.error('Error scheduling next batch:', error)
        }
      }, 5000) // 5 second delay between batches
    }

    console.log(`Batch completed for queue ${queueId}. Processed: ${jobs.length}, Completed: ${completedJobs}, Failed: ${failedJobs}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: jobs.length,
        completed: completedJobs,
        failed: failedJobs
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing email queue:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
