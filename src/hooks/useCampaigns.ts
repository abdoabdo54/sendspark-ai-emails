import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        error_message: item.error_message || undefined,
        completed_at: item.completed_at || undefined
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
    }, 3000); // Fast polling every 3 seconds for real-time updates
    
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
      
      // Enhanced success notification with redirect functionality
      toast({
        title: "Campaign Created Successfully!",
        description: "Your campaign has been created and is ready to be prepared and sent. Click here to manage it in the campaigns page.",
        duration: 8000,
        onClick: () => {
          window.location.href = '/campaigns';
        }
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
        prepared_emails: Array.isArray(updatedCampaign.prepared_emails) ? updatedCampaign.prepared_emails : [],
        error_message: updatedCampaign.error_message || undefined,
        completed_at: updatedCampaign.completed_at || undefined
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
      console.log('Preparing campaign with enhanced analytics and auto test-after:', campaignId);

      // Get campaign details to check configuration
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Parse recipients to check for test emails
      const allRecipients = campaign.recipients.split(',').map(email => email.trim()).filter(email => email);
      console.log('Recipients including test emails:', allRecipients);

      // Get accounts based on campaign configuration
      let accountQuery = supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const { data: accounts, error: accountsError } = await accountQuery;

      if (accountsError) {
        console.error('Error fetching accounts:', accountsError);
        throw new Error('Failed to fetch email accounts');
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No active email accounts found. Please add and activate at least one email account in Settings.');
      }

      // Use selected accounts or all accounts if none selected
      const campaignConfig = campaign.config || {};
      const selectedAccountIds = campaignConfig.selectedAccounts || [];
      const accountsToUse = selectedAccountIds.length > 0 
        ? accounts.filter(acc => selectedAccountIds.includes(acc.id))
        : accounts; // Use all accounts if none specifically selected

      if (accountsToUse.length === 0) {
        throw new Error('No valid accounts found for campaign preparation');
      }

      // Mark campaign as prepared - no need for complex preparation
      await updateCampaign(campaignId, { 
        status: 'prepared',
        prepared_emails: [] // Empty array since we'll process on-demand
      });

      toast({
        title: "Success",
        description: `Campaign prepared successfully! Ready to send ${allRecipients.length} emails using ${accountsToUse.length} accounts.`
      });

      await fetchCampaigns();
      
      return { success: true, totalEmails: allRecipients.length, accountsUsed: accountsToUse.length };
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
      console.log('🚀 Initiating PARALLEL Google Cloud send for campaign:', campaignId);

      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'sending') {
        throw new Error('Campaign is already being sent');
      }

      await updateCampaign(campaignId, { 
        status: 'sending',
        sent_at: new Date().toISOString(),
        error_message: null
      });

      const cfg = campaign.config || {};
      const googleCloudConfig = cfg.googleCloudFunctions;
      
      if (!googleCloudConfig?.enabled || !googleCloudConfig.functionUrls?.length) {
        throw new Error('Google Cloud Functions not configured or no function URLs provided');
      }

      const functionUrls = googleCloudConfig.functionUrls.filter((url: string) => url.trim());
      if (functionUrls.length === 0) {
        throw new Error('No valid function URLs found');
      }

      const zeroDelay = cfg.sendingMode === 'zero-delay';
      const totalRecipients = campaign.total_recipients;
      const numFunctions = functionUrls.length;

      console.log(`📊 Parallel dispatch: ${totalRecipients} emails across ${numFunctions} functions`);

      // Calculate email distribution across functions
      const emailsPerFunction = Math.ceil(totalRecipients / numFunctions);
      const requests: Promise<Response>[] = [];

      // Create parallel requests to all functions
      for (let i = 0; i < numFunctions; i++) {
        const skip = i * emailsPerFunction;
        const limit = Math.min(emailsPerFunction, totalRecipients - skip);
        
        if (limit > 0) {
          const functionUrl = functionUrls[i];
          
          console.log(`📤 Function ${i + 1}: ${functionUrl} (skip: ${skip}, limit: ${limit})`);
          
          const requestPromise = fetch(functionUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ 
              campaignId, 
              skip, 
              limit,
              zeroDelay,
              useTestAfter: cfg.testAfter?.enabled || false,
              testAfterEmail: cfg.testAfter?.email || '',
              testAfterCount: cfg.testAfter?.count || 500,
              useTracking: cfg.tracking?.enabled || false
            })
          });
          
          requests.push(requestPromise);
        }
      }

      console.log(`🔥 Dispatching ${requests.length} parallel requests...`);

      // Execute all requests in parallel
      const results = await Promise.allSettled(requests);
      
      // Check results
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.ok
      ).length;
      
      const failed = results.length - successful;

      if (successful === 0) {
        await updateCampaign(campaignId, { 
          status: 'prepared', 
          error_message: 'All function calls failed' 
        });
        throw new Error('All function calls failed');
      }

      if (failed > 0) {
        console.warn(`⚠️ ${failed} out of ${results.length} function calls failed`);
      }

      toast({
        title: `🚀 Parallel Campaign Started!`,
        description: `Dispatched to ${successful} functions${failed > 0 ? ` (${failed} failed)` : ''}. Real-time updates every 3 seconds.`
      });

      // Start polling for status updates
      startPolling();
      await fetchCampaigns();
      
      return { success: true, functionsUsed: successful, functionsFailed: failed };
    } catch (error) {
      console.error('💥 CRITICAL ERROR in parallel Google Cloud send:', error);
      
      const errorMsg = error.message.includes('fetch')
        ? 'Network error calling Google Cloud Functions. Check your function URLs and deployment.'
        : `Parallel campaign failed: ${error.message}`;
      
      toast({
        title: "⚡ Parallel Campaign Failed",
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
        const sentCount = campaign.sent_count || 0;
        await sendCampaignViaGoogleCloud(campaignId, sentCount);
      } else if (campaign.status === 'prepared') {
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
      const { data: originalCampaign, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (fetchError) throw fetchError;

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
    sendCampaign: sendCampaignViaGoogleCloud,
    sendCampaignViaGoogleCloud,
    pauseCampaign,
    resumeCampaign,
    duplicateCampaign,
    deleteCampaign,
    refetch: fetchCampaigns
  };
};
