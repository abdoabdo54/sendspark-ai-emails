
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EmailJob, MiddlewareConfig, MiddlewareStatus } from '@/types/middleware';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';
import { toast } from 'sonner';

export const useMiddlewareController = (config: MiddlewareConfig) => {
  const [status, setStatus] = useState<MiddlewareStatus>({
    isRunning: false,
    activeJobs: 0,
    pausedJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    errors: []
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch jobs from email_jobs table
  const fetchJobs = useCallback(async (): Promise<EmailJob[]> => {
    try {
      const { data, error } = await supabase
        .from('email_jobs')
        .select('*')
        .in('status', ['pending', 'active', 'retry'])
        .order('created_at', { ascending: true })
        .limit(config.maxConcurrency);

      if (error) {
        console.error('Error fetching email jobs:', error);
        return [];
      }
      
      return (data || []) as EmailJob[];
    } catch (error) {
      console.error('Error fetching email jobs:', error);
      return [];
    }
  }, [config.maxConcurrency]);

  // Update job status in email_jobs table
  const updateJobStatus = useCallback(async (
    jobId: string, 
    updates: Partial<EmailJob>
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('email_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }, []);

  // Process a single email job via Apps Script
  const processEmailJob = useCallback(async (job: EmailJob): Promise<void> => {
    try {
      console.log(`🔄 Processing email job ${job.id} to ${job.recipient_email}`);
      
      // Check if job is still active (could have been paused during processing)
      const { data: currentJob } = await supabase
        .from('email_jobs')
        .select('status')
        .eq('id', job.id)
        .single();

      if (currentJob?.status === 'paused') {
        console.log(`⏸️ Job ${job.id} is paused, skipping`);
        return;
      }

      // Send email via Apps Script
      const result = await sendEmailViaAppsScript(
        { exec_url: config.appsScriptExecUrl, daily_quota: 1000 },
        job.from_email,
        job.from_name,
        job.recipient_email,
        job.subject,
        job.html_content,
        job.text_content
      );

      if (result.success) {
        await updateJobStatus(job.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          apps_script_response: result
        });
        console.log(`✅ Email job ${job.id} sent successfully`);
      } else {
        const newRetryCount = job.retry_count + 1;
        const shouldRetry = newRetryCount < job.max_retries;
        
        await updateJobStatus(job.id, {
          status: shouldRetry ? 'retry' : 'failed',
          retry_count: newRetryCount,
          error_message: result.error,
          apps_script_response: result
        });
        
        console.log(`❌ Email job ${job.id} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error processing email job ${job.id}:`, error);
      await updateJobStatus(job.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [config.appsScriptExecUrl, updateJobStatus]);

  // Main processing loop
  const processJobs = useCallback(async (): Promise<void> => {
    if (!config.enabled || isProcessing) return;

    setIsProcessing(true);
    try {
      const jobs = await fetchJobs();
      console.log(`📋 Found ${jobs.length} jobs to process`);

      // Process jobs concurrently but respect maxConcurrency
      const activeJobs = jobs.filter(job => job.status === 'active' || job.status === 'pending' || job.status === 'retry');
      const processingPromises = activeJobs.slice(0, config.maxConcurrency).map(processEmailJob);
      
      await Promise.allSettled(processingPromises);

      // Update status
      await updateStatus();
    } catch (error) {
      console.error('Error in processing loop:', error);
      setStatus(prev => ({
        ...prev,
        errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error']
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [config.enabled, config.maxConcurrency, isProcessing, fetchJobs, processEmailJob]);

  // Update middleware status
  const updateStatus = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('email_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error) throw error;

      const statusCounts = (data || []).reduce((acc: any, job: any) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setStatus(prev => ({
        ...prev,
        activeJobs: (statusCounts.active || 0) + (statusCounts.pending || 0) + (statusCounts.retry || 0),
        pausedJobs: statusCounts.paused || 0,
        completedJobs: statusCounts.sent || 0,
        failedJobs: statusCounts.failed || 0,
        lastProcessedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, []);

  // Start/stop middleware
  const startMiddleware = useCallback(() => {
    setStatus(prev => ({ ...prev, isRunning: true, errors: [] }));
    toast.success('PowerMTA Middleware started');
  }, []);

  const stopMiddleware = useCallback(() => {
    setStatus(prev => ({ ...prev, isRunning: false }));
    toast.success('PowerMTA Middleware stopped');
  }, []);

  // Pause/resume campaign
  const pauseCampaign = useCallback(async (campaignId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('email_jobs')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'active', 'retry']);

      if (error) throw error;
      
      await updateStatus();
      toast.success('Campaign paused successfully');
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast.error('Failed to pause campaign');
    }
  }, [updateStatus]);

  const resumeCampaign = useCallback(async (campaignId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('email_jobs')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('status', 'paused');

      if (error) throw error;
      
      await updateStatus();
      toast.success('Campaign resumed successfully');
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast.error('Failed to resume campaign');
    }
  }, [updateStatus]);

  // Polling effect
  useEffect(() => {
    if (!status.isRunning || !config.enabled) return;

    const interval = setInterval(processJobs, config.pollingInterval);
    return () => clearInterval(interval);
  }, [status.isRunning, config.enabled, config.pollingInterval, processJobs]);

  // Status update effect
  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  return {
    status,
    isProcessing,
    startMiddleware,
    stopMiddleware,
    pauseCampaign,
    resumeCampaign,
    processJobs,
    updateStatus
  };
};
