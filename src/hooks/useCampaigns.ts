
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Campaign {
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

      setCampaigns(data || []);
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

      return campaign;
    } catch (error) {
      console.error('Error in createCampaign:', error);
      throw error;
    }
  };

  const prepareCampaign = async (campaignId: string) => {
    try {
      console.log('Preparing campaign:', campaignId);

      const response = await supabase.functions.invoke('prepare-campaign-advanced', {
        body: { campaignId }
      });

      if (response.error) {
        console.error('Error preparing campaign:', response.error);
        throw new Error(response.error.message);
      }

      console.log('Campaign prepared successfully:', response.data);
      
      // Refresh campaigns to show updated status
      await fetchCampaigns();
      
      return response.data;
    } catch (error) {
      console.error('Error in prepareCampaign:', error);
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
        throw new Error(response.error.message);
      }

      console.log('Campaign sending initiated:', response.data);
      
      // Refresh campaigns to show updated status
      await fetchCampaigns();
      
      return response.data;
    } catch (error) {
      console.error('Error in sendCampaign:', error);
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
    prepareCampaign,
    sendCampaign,
    deleteCampaign,
    refetch: fetchCampaigns
  };
};
