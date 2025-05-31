
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

export const useEmailQueue = (organizationId?: string) => {
  const [queues, setQueues] = useState<SendingQueue[]>([]);
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueues = async () => {
    if (!organizationId) return;

    try {
      // For now, we'll use the existing campaigns table as a fallback
      // until the new tables are available in the database schema
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform campaigns to queue format for backwards compatibility
      const transformedQueues: SendingQueue[] = (data || []).map(campaign => ({
        id: campaign.id,
        organization_id: campaign.organization_id,
        name: `Campaign: ${campaign.subject}`,
        total_jobs: campaign.total_recipients || 0,
        completed_jobs: campaign.sent_count || 0,
        failed_jobs: 0,
        status: campaign.status === 'sent' ? 'completed' : 
                campaign.status === 'sending' ? 'running' : 'pending',
        max_concurrent_sends: 5,
        started_at: campaign.sent_at,
        completed_at: campaign.status === 'sent' ? campaign.sent_at : undefined,
        created_at: campaign.created_at,
        updated_at: campaign.created_at
      }));
      
      setQueues(transformedQueues);
    } catch (error) {
      console.error('Error fetching queues:', error);
      toast({
        title: "Error",
        description: "Failed to load sending queues",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async (queueId?: string) => {
    if (!organizationId) return;

    try {
      // For now, we'll create placeholder jobs based on campaigns
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;
      
      // Transform campaigns to jobs format for backwards compatibility
      const transformedJobs: EmailJob[] = (data || []).flatMap(campaign => {
        const recipients = campaign.recipients.split(',').map((email: string) => email.trim());
        return recipients.map((email: string, index: number) => ({
          id: `${campaign.id}-${index}`,
          organization_id: campaign.organization_id,
          campaign_id: campaign.id,
          recipient_email: email,
          recipient_data: {},
          from_name: campaign.from_name,
          subject: campaign.subject,
          html_content: campaign.html_content,
          text_content: campaign.text_content,
          custom_headers: {},
          status: campaign.status === 'sent' ? 'sent' : 'pending' as any,
          priority: 1,
          scheduled_at: campaign.created_at,
          sent_at: campaign.sent_at,
          retry_count: 0,
          created_at: campaign.created_at,
          updated_at: campaign.created_at
        }));
      });
      
      setJobs(queueId ? transformedJobs.filter(job => job.campaign_id === queueId) : transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load email jobs",
        variant: "destructive"
      });
    }
  };

  const createQueue = async (queueData: Omit<SendingQueue, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    if (!organizationId) return;

    try {
      // For now, create a campaign instead of a queue
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert([{
          organization_id: organizationId,
          from_name: 'Bulk Sender',
          subject: queueData.name,
          recipients: '',
          status: 'draft',
          send_method: 'smtp'
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sending queue created successfully"
      });
      
      fetchQueues();
      return data;
    } catch (error) {
      console.error('Error creating queue:', error);
      toast({
        title: "Error",
        description: "Failed to create sending queue",
        variant: "destructive"
      });
      throw error;
    }
  };

  const addJobsToQueue = async (queueId: string, jobsData: Omit<EmailJob, 'id' | 'created_at' | 'updated_at' | 'organization_id'>[]) => {
    try {
      // For now, we'll update the campaign with recipient information
      const recipients = jobsData.map(job => job.recipient_email).join(', ');
      
      const { error } = await supabase
        .from('email_campaigns')
        .update({ 
          recipients,
          total_recipients: jobsData.length
        })
        .eq('id', queueId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${jobsData.length} emails to the queue`
      });
      
      fetchQueues();
      fetchJobs(queueId);
    } catch (error) {
      console.error('Error adding jobs to queue:', error);
      toast({
        title: "Error",
        description: "Failed to add jobs to queue",
        variant: "destructive"
      });
    }
  };

  const updateQueueStatus = async (queueId: string, status: SendingQueue['status']) => {
    try {
      const campaignStatus = status === 'running' ? 'sending' : 
                           status === 'completed' ? 'sent' : 'draft';
      
      const { error } = await supabase
        .from('email_campaigns')
        .update({ 
          status: campaignStatus,
          sent_at: status === 'running' ? new Date().toISOString() : null
        })
        .eq('id', queueId);

      if (error) throw error;

      fetchQueues();
    } catch (error) {
      console.error('Error updating queue status:', error);
      toast({
        title: "Error",
        description: "Failed to update queue status",
        variant: "destructive"
      });
    }
  };

  const deleteQueue = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', queueId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Queue deleted successfully"
      });
      
      fetchQueues();
    } catch (error) {
      console.error('Error deleting queue:', error);
      toast({
        title: "Error",
        description: "Failed to delete queue",
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
    createQueue,
    addJobsToQueue,
    updateQueueStatus,
    deleteQueue,
    fetchJobs,
    refetch: fetchQueues
  };
};
