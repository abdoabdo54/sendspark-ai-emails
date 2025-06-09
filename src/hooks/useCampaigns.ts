import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Campaign {
  id: string;
  from_name: string;
  subject: string;
  recipients: string;
  html_content?: string;
  text_content?: string;
  send_method: string;
  status: 'draft' | 'prepared' | 'sending' | 'sent' | 'failed' | 'paused';
  sent_count: number;
  total_recipients: number;
  organization_id: string;
  created_at: string;
  sent_at?: string;
  config?: any;
  prepared_emails?: any[];
  error_message?: string;
  completed_at?: string;
}

export const useCampaigns = (organizationId?: string) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchCampaigns = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedCampaigns: Campaign[] = (data || []).map(item => ({
        id: item.id,
        from_name: item.from_name || '',
        subject: item.subject || '',
        recipients: item.recipients || '',
        html_content: item.html_content || '',
        text_content: item.text_content || '',
        send_method: item.send_method || '',
        status: (item.status as Campaign['status']) || 'draft',
        sent_count: item.sent_count || 0,
        total_recipients: item.total_recipients || 0,
        organization_id: item.organization_id || '',
        created_at: item.created_at || '',
        sent_at: item.sent_at || undefined,
        config: typeof item.config === 'object' && item.config !== null ? item.config : {},
        prepared_emails: Array.isArray(item.prepared_emails) ? item.prepared_emails : [],
        error_message: (item as any).error_message || undefined,
        completed_at: (item as any).completed_at || undefined
      }));
      
      setCampaigns(typedCampaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Optimized polling with better error handling
  const startPolling = () => {
    if (pollingInterval) return;
    
    const interval = setInterval(async () => {
      const sendingCampaigns = campaigns.filter(c => c.status === 'sending');
      if (sendingCampaigns.length > 0) {
        console.log(`Polling status for ${sendingCampaigns.length} sending campaigns`);
        await fetchCampaigns();
      } else {
        stopPolling();
      }
    }, 5000); // Poll every 5 seconds instead of 3
    
    setPollingInterval(interval);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  useEffect(() => {
    const sendingCampaigns = campaigns.filter(c => c.status === 'sending');
    if (sendingCampaigns.length > 0) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [campaigns]);

  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'created_at' | 'status' | 'sent_count' | 'total_recipients' | 'organization_id' | 'prepared_emails'>) => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive"
      });
      throw new Error('Organization ID is required');
    }

    try {
      console.log('Creating campaign with data:', campaignData);
      
      const recipientCount = campaignData.recipients.split(',').filter(email => email.trim()).length;
      
      const campaignToCreate = {
        from_name: campaignData.from_name,
        subject: campaignData.subject,
        recipients: campaignData.recipients,
        html_content: campaignData.html_content || '',
        text_content: campaignData.text_content || '',
        send_method: campaignData.send_method,
        organization_id: organizationId,
        total_recipients: recipientCount,
        sent_count: 0,
        status: 'draft' as const,
        config: campaignData.config || {},
        prepared_emails: []
      };

      console.log('Campaign payload:', campaignToCreate);

      const { data, error } = await supabase
        .from('email_campaigns')
        .insert([campaignToCreate])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Properly cast the returned data with better type safety
      const typedCampaign: Campaign = {
        id: data.id,
        from_name: data.from_name || '',
        subject: data.subject || '',
        recipients: data.recipients || '',
        html_content: data.html_content || '',
        text_content: data.text_content || '',
        send_method: data.send_method || '',
        status: (data.status as Campaign['status']) || 'draft',
        sent_count: data.sent_count || 0,
        total_recipients: data.total_recipients || 0,
        organization_id: data.organization_id || '',
        created_at: data.created_at || '',
        sent_at: data.sent_at || undefined,
        config: typeof data.config === 'object' && data.config !== null ? data.config : {},
        prepared_emails: Array.isArray(data.prepared_emails) ? data.prepared_emails : []
      };

      setCampaigns(prev => [typedCampaign, ...prev]);
      
      toast({
        title: "Success",
        description: "Campaign created successfully"
      });
      
      return typedCampaign;
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to create campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      console.log('Updating campaign:', campaignId, updates);

      // Use upsert to avoid "no rows returned" error
      const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select();

      if (error) {
        console.error('Error updating campaign:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('No campaign found to update:', campaignId);
        return null;
      }

      const updatedCampaign = data[0];
      const typedCampaign: Campaign = {
        id: updatedCampaign.id,
        from_name: updatedCampaign.from_name || '',
        subject: updatedCampaign.subject || '',
        recipients: updatedCampaign.recipients || '',
        html_content: updatedCampaign.html_content || '',
        text_content: updatedCampaign.text_content || '',
        send_method: updatedCampaign.send_method || '',
        status: (updatedCampaign.status as Campaign['status']) || 'draft',
        sent_count: updatedCampaign.sent_count || 0,
        total_recipients: updatedCampaign.total_recipients || 0,
        organization_id: updatedCampaign.organization_id || '',
        created_at: updatedCampaign.created_at || '',
        sent_at: updatedCampaign.sent_at || undefined,
        config: typeof updatedCampaign.config === 'object' && updatedCampaign.config !== null ? updatedCampaign.config : {},
        prepared_emails: Array.isArray(updatedCampaign.prepared_emails) ? updatedCampaign.prepared_emails : []
      };

      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? typedCampaign : campaign
      ));

      return typedCampaign;
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  };

  const prepareCampaign = async (campaignId: string) => {
    try {
      console.log('Preparing campaign with advanced system:', campaignId);

      // Get all active email accounts for this organization
      const { data: accounts, error: accountsError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (accountsError) {
        console.error('Error fetching accounts:', accountsError);
        throw new Error('Failed to fetch email accounts');
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No active email accounts found. Please add and activate at least one email account in Settings.');
      }

      // Use all available accounts
      const selectedAccounts = accounts.map(account => account.id);

      // Get Google Cloud Functions configuration from localStorage
      let googleCloudConfig = null;
      try {
        const savedSettings = localStorage.getItem('emailCampaignSettings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.googleCloudFunctions?.enabled && parsed.googleCloudFunctions?.functionUrl) {
            googleCloudConfig = {
              enabled: true,
              functionUrl: parsed.googleCloudFunctions.functionUrl,
              defaultRateLimit: parsed.googleCloudFunctions.defaultRateLimit || 3600,
              defaultBatchSize: parsed.googleCloudFunctions.defaultBatchSize || 10
            };
          }
        }
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }

      // Default configuration for campaign preparation
      const rotation = {
        useFromNameRotation: false,
        fromNames: [],
        useSubjectRotation: false,
        subjects: []
      };

      // Default rate limits (emails per hour converted to emails per second for the function)
      const rateLimit = {};
      accounts.forEach(account => {
        const accountConfig = account.config as any; // Safely cast the config
        const emailsPerHour = accountConfig?.emails_per_hour || 3600;
        rateLimit[account.id] = emailsPerHour; // Keep as emails per hour, function will convert
      });

      console.log('Preparing campaign with:', {
        campaignId,
        selectedAccounts,
        rotation,
        rateLimit,
        googleCloudConfig
      });

      // Call the advanced prepare function with all required parameters
      const { data, error } = await supabase.functions.invoke('prepare-campaign-advanced', {
        body: { 
          campaignId,
          selectedAccounts,
          rotation,
          rateLimit,
          googleCloudConfig
        }
      });

      if (error) {
        console.error('Error calling prepare-campaign-advanced:', error);
        throw error;
      }

      console.log('Advanced campaign preparation result:', data);

      toast({
        title: "Success",
        description: `Campaign prepared successfully! ${data.totalEmails} emails ready across ${data.accountsUsed} accounts.`
      });

      // Refresh campaigns to get updated status
      await fetchCampaigns();
      
      return data;
    } catch (error) {
      console.error('Error preparing campaign:', error);
      toast({
        title: "Error",
        description: `Failed to prepare campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const sendCampaignViaGoogleCloud = async (campaignId: string, resumeFromIndex = 0) => {
    try {
      console.log('Initiating Google Cloud send for campaign:', campaignId);

      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update status to sending immediately
      await updateCampaign(campaignId, { 
        status: 'sending',
        sent_at: new Date().toISOString()
      });

      // Call the enhanced Google Cloud sender
      const { data, error } = await supabase.functions.invoke('send-via-google-cloud-advanced', {
        body: { campaignId, resumeFromIndex }
      });

      if (error) {
        console.error('Error calling Google Cloud sender:', error);
        
        // Revert status on error
        await updateCampaign(campaignId, { 
          status: 'prepared',
          error_message: `Google Cloud error: ${error.message}`
        });
        
        throw error;
      }

      console.log('Google Cloud send initiated:', data);

      if (data.success) {
        toast({
          title: "Campaign Sending Started!",
          description: `Processing ${data.configuration?.total_emails || 0} emails. The system will handle sending at maximum speed.`
        });

        // Start polling for updates
        startPolling();
      } else {
        throw new Error(data.error || 'Failed to start campaign sending');
      }

      await fetchCampaigns();
      return data;
    } catch (error) {
      console.error('Error sending campaign via Google Cloud:', error);
      
      const errorMsg = error.message.includes('non-2xx status code')
        ? 'Google Cloud Function error. Please check your configuration and try again.'
        : `Failed to send campaign: ${error.message}`;
      
      toast({
        title: "Campaign Send Failed",
        description: errorMsg,
        variant: "destructive"
      });
      
      throw error;
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      console.log('Sending campaign:', campaignId);

      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Always use Google Cloud Functions for maximum speed
      return await sendCampaignViaGoogleCloud(campaignId);
    } catch (error) {
      console.error('Error sending campaign:', error);
      throw error;
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      await updateCampaign(campaignId, { status: 'paused' });
      toast({
        title: "Success",
        description: "Campaign paused successfully. You can resume sending anytime."
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      throw error;
    }
  };

  const resumeCampaign = async (campaignId: string) => {
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'paused') {
        // Resume from where we left off
        const sentCount = campaign.sent_count || 0;
        await sendCampaignViaGoogleCloud(campaignId, sentCount);
      } else if (campaign.status === 'prepared') {
        // Start sending from the beginning
        await sendCampaignViaGoogleCloud(campaignId, 0);
      } else {
        throw new Error('Campaign must be prepared or paused to resume');
      }
    } catch (error) {
      console.error('Error resuming campaign:', error);
      throw error;
    }
  };

  const duplicateCampaign = async (campaignId: string) => {
    try {
      // Get the original campaign
      const { data: originalCampaign, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (fetchError) throw fetchError;

      // Create a duplicate with modified name
      const duplicateData = {
        from_name: originalCampaign.from_name,
        subject: `Copy of ${originalCampaign.subject}`,
        recipients: originalCampaign.recipients,
        html_content: originalCampaign.html_content,
        text_content: originalCampaign.text_content,
        send_method: originalCampaign.send_method,
        config: originalCampaign.config || {}
      };

      return await createCampaign(duplicateData);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate campaign",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
      
      toast({
        title: "Success",
        description: "Campaign deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchCampaigns();
    }
  }, [organizationId]);

  return {
    campaigns,
    loading,
    createCampaign,
    updateCampaign,
    prepareCampaign,
    sendCampaign,
    sendCampaignViaGoogleCloud,
    pauseCampaign,
    resumeCampaign,
    duplicateCampaign,
    deleteCampaign,
    refetch: fetchCampaigns
  };
};
