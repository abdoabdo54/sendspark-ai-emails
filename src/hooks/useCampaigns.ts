import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Campaign {
  id: string;
  from_name: string;
  subject: string;
  recipients: string;
  html_content: string;
  text_content?: string;
  send_method: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  created_at: string;
  sent_at?: string;
  completed_at?: string;
  config?: any;
  organization_id: string;
  prepared_emails?: any[];
  error_message?: string;
}

interface CreateCampaignData {
  from_name: string;
  subject: string;
  recipients: string;
  html_content: string;
  text_content?: string;
  send_method: string;
  config?: any;
}

export const useCampaigns = (organizationId?: string) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    if (!organizationId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching campaigns:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Transform the data to match Campaign interface
      const transformedData = (data || []).map(campaign => ({
        ...campaign,
        prepared_emails: Array.isArray(campaign.prepared_emails) ? campaign.prepared_emails : []
      }));

      setCampaigns(transformedData);
    } catch (err) {
      console.error('Error in fetchCampaigns:', err);
      setError('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async (campaignData: CreateCampaignData): Promise<Campaign> => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    try {
      console.log('Creating campaign with data:', campaignData);

      // Parse recipients and calculate total
      const emailList = campaignData.recipients
        .split(/[\n,]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.length > 3);

      const totalRecipients = emailList.length;

      if (totalRecipients === 0) {
        throw new Error('No valid email recipients found');
      }

      // Enhanced config with all new features
      const enhancedConfig = {
        ...campaignData.config,
        // Ensure all rotation settings are preserved
        useFromNameRotation: campaignData.config?.useFromNameRotation || false,
        fromNames: campaignData.config?.fromNames || [],
        useSubjectRotation: campaignData.config?.useSubjectRotation || false,
        subjects: campaignData.config?.subjects || [],
        
        // Enhanced test after configuration
        useTestAfter: campaignData.config?.useTestAfter || false,
        testAfterEmail: campaignData.config?.testAfterEmail || '',
        testAfterCount: campaignData.config?.testAfterCount || 100,
        testEmailSubjectPrefix: campaignData.config?.testEmailSubjectPrefix || 'TEST DELIVERY REPORT',
        
        // Flexible rate limiting
        sendingMode: campaignData.config?.sendingMode || 'controlled',
        emailsPerSecond: campaignData.config?.emailsPerSecond || 1,
        emailsPerMinute: campaignData.config?.emailsPerMinute || 60,
        burstSize: campaignData.config?.burstSize || 10,
        useCustomDelay: campaignData.config?.useCustomDelay || false,
        customDelayMs: campaignData.config?.customDelayMs || 1000,
        
        // Selected accounts
        selectedAccounts: campaignData.config?.selectedAccounts || [],
        
        // Legacy compatibility
        delay_between_emails: campaignData.config?.delay_between_emails || 1,
        max_emails_per_hour: campaignData.config?.max_emails_per_hour || 3600
      };

      // Create campaign record
      const { data: campaign, error: createError } = await supabase
        .from('email_campaigns')
        .insert({
          from_name: campaignData.from_name,
          subject: campaignData.subject,
          recipients: emailList.join(','),
          html_content: campaignData.html_content,
          text_content: campaignData.text_content || '',
          send_method: campaignData.send_method,
          status: 'draft',
          total_recipients: totalRecipients,
          sent_count: 0,
          organization_id: organizationId,
          config: enhancedConfig
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating campaign:', createError);
        throw new Error(`Failed to create campaign: ${createError.message}`);
      }

      console.log('Campaign created successfully:', campaign);

      // Transform the returned data
      const transformedCampaign = {
        ...campaign,
        prepared_emails: Array.isArray(campaign.prepared_emails) ? campaign.prepared_emails : []
      };

      // Auto-prepare the campaign
      try {
        console.log('Auto-preparing campaign...');
        await prepareCampaign(campaign.id);
        
        toast({
          title: "Success",
          description: `Campaign created and prepared with ${totalRecipients} recipients!`
        });
      } catch (prepareError) {
        console.error('Error preparing campaign:', prepareError);
        toast({
          title: "Campaign Created",
          description: `Campaign created but failed to prepare: ${prepareError.message}`,
          variant: "destructive"
        });
      }

      // Refresh campaigns list
      await fetchCampaigns();

      return transformedCampaign;
    } catch (error) {
      console.error('Error in createCampaign:', error);
      throw error;
    }
  };

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', campaignId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Refresh campaigns list
      await fetchCampaigns();
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  };

  const prepareCampaign = async (campaignId: string) => {
    try {
      console.log('Preparing campaign:', campaignId);
      
      // Get the campaign to access its config
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Ensure we have accounts selected
      const selectedAccounts = campaign.config?.selectedAccounts || [];
      console.log('Selected accounts for preparation:', selectedAccounts);
      
      if (!selectedAccounts || selectedAccounts.length === 0) {
        console.error('No accounts selected for campaign');
        throw new Error('Please select at least one email account for sending');
      }

      // Prepare the request body with all necessary configuration
      const requestBody = {
        campaignId,
        selectedAccounts,
        rotation: {
          useFromNameRotation: campaign.config?.useFromNameRotation || false,
          fromNames: campaign.config?.fromNames || [],
          useSubjectRotation: campaign.config?.useSubjectRotation || false,
          subjects: campaign.config?.subjects || []
        },
        rateLimit: campaign.config?.rateLimit || {},
        testAfter: {
          useTestAfter: campaign.config?.useTestAfter || false,
          testAfterEmail: campaign.config?.testAfterEmail || '',
          testAfterCount: campaign.config?.testAfterCount || 100,
          testEmailSubjectPrefix: campaign.config?.testEmailSubjectPrefix || 'TEST DELIVERY REPORT'
        },
        sendingMode: campaign.config?.sendingMode || 'controlled',
        googleCloudConfig: campaign.config?.googleCloudConfig || null
      };
      
      console.log('Prepare campaign request body:', requestBody);

      const response = await supabase.functions.invoke('prepare-campaign-advanced', {
        body: requestBody
      });

      if (response.error) {
        console.error('Error preparing campaign:', response.error);
        throw new Error(response.error.message);
      }

      console.log('Campaign prepared successfully:', response.data);
      
      // Refresh campaigns to show updated status
      await fetchCampaigns();
      
      toast({
        title: "Success",
        description: "Campaign prepared successfully and ready to send!"
      });
      
      return response.data;
    } catch (error) {
      console.error('Error in prepareCampaign:', error);
      toast({
        title: "Error",
        description: `Failed to prepare campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      console.log('Sending campaign via Google Cloud:', campaignId);

      const response = await supabase.functions.invoke('send-via-google-cloud-advanced', {
        body: { 
          campaignId,
          resumeFromIndex: 0
        }
      });

      if (response.error) {
        console.error('Error sending campaign:', response.error);
        
        // Provide more helpful error messages based on error content
        let errorMessage = response.error.message;
        if (errorMessage.includes('Google Cloud Functions not configured')) {
          errorMessage = 'Google Cloud Function URL not configured. Please go to Settings → Google Cloud Config to set up your function URL.';
        } else if (errorMessage.includes('non-2xx status code')) {
          errorMessage = 'Google Cloud Function URL is not responding correctly. Please check your function URL in Settings → Google Cloud Config.';
        }
        
        toast({
          title: "Configuration Error",
          description: errorMessage,
          variant: "destructive"
        });
        
        throw new Error(errorMessage);
      }

      console.log('Campaign sending initiated:', response.data);
      
      // Refresh campaigns to show updated status
      await fetchCampaigns();
      
      toast({
        title: "Success",
        description: "Campaign sending initiated successfully!"
      });
      
      return response.data;
    } catch (error) {
      console.error('Error in sendCampaign:', error);
      
      // Don't show duplicate toast if we already showed one above
      if (!error.message.includes('Google Cloud Function')) {
        toast({
          title: "Error",
          description: `Failed to send campaign: ${error.message}`,
          variant: "destructive"
        });
      }
      
      throw error;
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await fetchCampaigns();
      
      toast({
        title: "Success",
        description: "Campaign paused successfully"
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast({
        title: "Error",
        description: `Failed to pause campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const resumeCampaign = async (campaignId: string) => {
    try {
      const response = await supabase.functions.invoke('send-via-google-cloud-advanced', {
        body: { 
          campaignId,
          resumeFromIndex: 0
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await fetchCampaigns();
      
      toast({
        title: "Success",
        description: "Campaign resumed successfully"
      });
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast({
        title: "Error",
        description: `Failed to resume campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const duplicateCampaign = async (campaignId: string) => {
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const duplicateData: CreateCampaignData = {
        from_name: campaign.from_name,
        subject: `Copy of ${campaign.subject}`,
        recipients: campaign.recipients,
        html_content: campaign.html_content,
        text_content: campaign.text_content,
        send_method: campaign.send_method,
        config: campaign.config
      };

      await createCampaign(duplicateData);
      
      toast({
        title: "Success",
        description: "Campaign duplicated successfully"
      });
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to duplicate campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Refresh campaigns list
      await fetchCampaigns();
      
      toast({
        title: "Success",
        description: "Campaign deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: `Failed to delete campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [organizationId]);

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    prepareCampaign,
    sendCampaign,
    pauseCampaign,
    resumeCampaign,
    duplicateCampaign,
    deleteCampaign,
    refetch: fetchCampaigns
  };
};
