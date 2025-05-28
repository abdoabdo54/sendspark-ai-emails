
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EmailJob {
  id: string;
  organization_id: string;
  campaign_id?: string;
  recipient_email: string;
  recipient_data: any;
  from_name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  custom_headers: any;
  account_id?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'paused';
  priority: number;
  scheduled_at: string;
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  queue_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SendingQueue {
  id: string;
  organization_id: string;
  name: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  max_concurrent_sends: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BulkEmailData {
  recipients: Array<{ email: string; [key: string]: any }>;
  fromNames: string[];
  subjects: string[];
  htmlContent: string;
  textContent?: string;
  customHeaders: { [key: string]: string };
  sendingAccounts: string[];
  maxConcurrentSends: number;
  rateLimitPerHour: number;
  testEmailAddress?: string;
  testEmailFrequency?: number;
}

export const useEmailQueue = (organizationId?: string) => {
  const [queues, setQueues] = useState<SendingQueue[]>([]);
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchQueues = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('sending_queues')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueues(data || []);
    } catch (error) {
      console.error('Error fetching queues:', error);
      toast({
        title: "Error",
        description: "Failed to load sending queues",
        variant: "destructive"
      });
    }
  };

  const fetchJobs = async (queueId?: string) => {
    if (!organizationId) return;

    try {
      let query = supabase
        .from('email_jobs')
        .select('*')
        .eq('organization_id', organizationId);

      if (queueId) {
        query = query.eq('queue_id', queueId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load email jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createBulkQueue = async (data: BulkEmailData): Promise<string | null> => {
    if (!organizationId) return null;

    try {
      setProcessing(true);

      // Create the queue
      const { data: queue, error: queueError } = await supabase
        .from('sending_queues')
        .insert([{
          organization_id: organizationId,
          name: `Bulk Campaign ${new Date().toLocaleString()}`,
          total_jobs: data.recipients.length,
          max_concurrent_sends: data.maxConcurrentSends,
          status: 'pending'
        }])
        .select()
        .single();

      if (queueError) throw queueError;

      // Create individual email jobs
      const emailJobs = [];
      let fromNameIndex = 0;
      let subjectIndex = 0;
      let accountIndex = 0;

      for (let i = 0; i < data.recipients.length; i++) {
        const recipient = data.recipients[i];
        
        // Rotate through from names, subjects, and accounts
        const fromName = data.fromNames[fromNameIndex % data.fromNames.length];
        const subject = data.subjects[subjectIndex % data.subjects.length];
        const accountId = data.sendingAccounts[accountIndex % data.sendingAccounts.length];

        // Process placeholders and spintax
        const processedContent = processEmailContent(
          data.htmlContent,
          recipient,
          fromName,
          subject,
          recipient.email
        );

        const processedSubject = processEmailContent(
          subject,
          recipient,
          fromName,
          subject,
          recipient.email
        );

        emailJobs.push({
          organization_id: organizationId,
          queue_id: queue.id,
          recipient_email: recipient.email,
          recipient_data: recipient,
          from_name: fromName,
          subject: processedSubject,
          html_content: processedContent,
          text_content: data.textContent ? processEmailContent(
            data.textContent,
            recipient,
            fromName,
            subject,
            recipient.email
          ) : undefined,
          custom_headers: data.customHeaders,
          account_id: accountId,
          status: 'pending',
          priority: 1,
          scheduled_at: new Date().toISOString(),
          retry_count: 0
        });

        fromNameIndex++;
        subjectIndex++;
        accountIndex++;
      }

      const { error: jobsError } = await supabase
        .from('email_jobs')
        .insert(emailJobs);

      if (jobsError) throw jobsError;

      toast({
        title: "Queue Created",
        description: `Created bulk queue with ${data.recipients.length} email jobs`,
      });

      await fetchQueues();
      return queue.id;

    } catch (error) {
      console.error('Error creating bulk queue:', error);
      toast({
        title: "Error",
        description: "Failed to create bulk email queue",
        variant: "destructive"
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const startQueue = async (queueId: string) => {
    try {
      // Update queue status
      const { error: updateError } = await supabase
        .from('sending_queues')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', queueId);

      if (updateError) throw updateError;

      // Start processing jobs
      await supabase.functions.invoke('process-email-queue', {
        body: { queueId }
      });

      toast({
        title: "Queue Started",
        description: "Email queue processing has started",
      });

      await fetchQueues();
    } catch (error) {
      console.error('Error starting queue:', error);
      toast({
        title: "Error",
        description: "Failed to start email queue",
        variant: "destructive"
      });
    }
  };

  const pauseQueue = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('sending_queues')
        .update({ status: 'paused' })
        .eq('id', queueId);

      if (error) throw error;

      toast({
        title: "Queue Paused",
        description: "Email queue has been paused",
      });

      await fetchQueues();
    } catch (error) {
      console.error('Error pausing queue:', error);
      toast({
        title: "Error",
        description: "Failed to pause email queue",
        variant: "destructive"
      });
    }
  };

  const deleteQueue = async (queueId: string) => {
    try {
      // Delete associated jobs first
      const { error: jobsError } = await supabase
        .from('email_jobs')
        .delete()
        .eq('queue_id', queueId);

      if (jobsError) throw jobsError;

      // Delete the queue
      const { error: queueError } = await supabase
        .from('sending_queues')
        .delete()
        .eq('id', queueId);

      if (queueError) throw queueError;

      toast({
        title: "Queue Deleted",
        description: "Email queue and all associated jobs have been deleted",
      });

      await fetchQueues();
    } catch (error) {
      console.error('Error deleting queue:', error);
      toast({
        title: "Error",
        description: "Failed to delete email queue",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchQueues();
      fetchJobs();
    }
  }, [organizationId]);

  return {
    queues,
    jobs,
    loading,
    processing,
    createBulkQueue,
    startQueue,
    pauseQueue,
    deleteQueue,
    fetchQueues,
    fetchJobs
  };
};

// Helper function to process email content with placeholders and spintax
function processEmailContent(
  content: string,
  recipientData: any,
  fromName: string,
  subject: string,
  toEmail: string
): string {
  let processed = content;

  // Process recipient data placeholders
  Object.keys(recipientData).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'gi');
    processed = processed.replace(regex, recipientData[key] || '');
  });

  // Process standard placeholders
  processed = processed
    .replace(/{{fromname}}/gi, fromName)
    .replace(/{{subject}}/gi, subject)
    .replace(/{{to}}/gi, toEmail)
    .replace(/{{name}}/gi, toEmail.split('@')[0])
    .replace(/{{date}}/gi, new Date().toLocaleDateString())
    .replace(/{{ide}}/gi, Math.random().toString(36).substring(2, 15));

  // Process random string placeholders
  processed = processed.replace(/{{rndn_(\d+)}}/gi, (match, length) => {
    return Math.random().toString(36).substring(2, 2 + parseInt(length));
  });

  processed = processed.replace(/{{rnda_(\d+)}}/gi, (match, length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < parseInt(length); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });

  // Process spintax {option1|option2|option3}
  processed = processed.replace(/\{([^}]+)\}/g, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });

  return processed;
}
