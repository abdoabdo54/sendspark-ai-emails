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
}

export const useCampaigns = (organizationId?: string) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Properly cast the data to Campaign type
      const typedCampaigns: Campaign[] = (data || []).map(item => ({
        ...item,
        status: item.status as Campaign['status'],
        config: item.config || {},
        prepared_emails: item.prepared_emails || []
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
        status: 'draft',
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

      // Properly cast the returned data
      const typedCampaign: Campaign = {
        ...data,
        status: data.status as Campaign['status'],
        config: data.config || {},
        prepared_emails: data.prepared_emails || []
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

      const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select()
        .single();

      if (error) {
        console.error('Error updating campaign:', error);
        throw error;
      }

      // Properly cast the returned data
      const typedCampaign: Campaign = {
        ...data,
        status: data.status as Campaign['status'],
        config: data.config || {},
        prepared_emails: data.prepared_emails || []
      };

      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? typedCampaign : campaign
      ));

      toast({
        title: "Success",
        description: "Campaign updated successfully"
      });

      return typedCampaign;
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to update campaign: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const prepareCampaign = async (campaignId: string) => {
    try {
      console.log('Preparing campaign:', campaignId);

      // Call the prepare function
      const { data, error } = await supabase.functions.invoke('prepare-campaign', {
        body: { campaignId }
      });

      if (error) {
        console.error('Error calling prepare-campaign:', error);
        throw error;
      }

      console.log('Campaign preparation result:', data);

      toast({
        title: "Success",
        description: "Campaign has been prepared and is ready to send"
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

  const sendCampaign = async (campaignId: string) => {
    try {
      console.log('Sending campaign:', campaignId);

      // Update campaign status to sending
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) {
        console.error('Error updating campaign status:', updateError);
        throw updateError;
      }

      // Call the enhanced send function
      const { data, error } = await supabase.functions.invoke('send-campaign-enhanced', {
        body: { campaignId }
      });

      if (error) {
        console.error('Error calling send-campaign-enhanced:', error);
        throw error;
      }

      console.log('Campaign send result:', data);

      toast({
        title: "Success",
        description: "Campaign is being sent"
      });

      // Refresh campaigns to get updated status
      await fetchCampaigns();
      
      return data;
    } catch (error) {
      console.error('Error sending campaign:', error);
      
      // Revert status back to prepared/draft on error
      await supabase
        .from('email_campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId);
      
      toast({
        title: "Error",
        description: `Failed to send campaign: ${error.message}`,
        variant: "destructive"
      });
      
      await fetchCampaigns();
      throw error;
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    try {
      await updateCampaign(campaignId, { status: 'paused' });
      toast({
        title: "Success",
        description: "Campaign has been paused"
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      throw error;
    }
  };

  const resumeCampaign = async (campaignId: string) => {
    try {
      // Find the campaign
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // If campaign is prepared, resume sending
      if (campaign.status === 'prepared' || campaign.status === 'paused') {
        await sendCampaign(campaignId);
      } else {
        throw new Error('Campaign must be prepared before resuming');
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
    pauseCampaign,
    resumeCampaign,
    duplicateCampaign,
    deleteCampaign,
    refetch: fetchCampaigns
  };
};
