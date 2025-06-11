
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Campaign {
  id: string;
  organization_id: string;
  from_name: string;
  subject: string;
  recipients: string;
  html_content: string;
  text_content: string;
  send_method: string;
  status: string;
  sent_count: number;
  total_recipients: number;
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

  const fetchCampaigns = async () => {
    if (!organizationId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setCampaigns(data || []);
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

  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'created_at' | 'organization_id'>) => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert([{
          ...campaignData,
          organization_id: organizationId
        }])
        .select()
        .single();

      if (error) throw error;

      setCampaigns(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Campaign created successfully"
      });
      
      return data;
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to create campaign: ${error.message}`,
        variant: "destructive"
      });
      return null;
    }
  };

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;

      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId ? data : campaign
      ));

      return data;
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive"
      });
      return null;
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
    }
  };

  const sendCampaign = async (campaignId: string, config?: any) => {
    try {
      // Get campaign details
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // For now, we'll use the existing send-campaign function
      // This will be updated when we implement the new GCF dispatch system
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: { campaignId, config }
      });

      if (error) throw error;

      // Update campaign status
      await updateCampaign(campaignId, { 
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      toast({
        title: "Success",
        description: "Campaign sent successfully"
      });

      return data;
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      await updateCampaign(campaignId, { 
        status: 'failed',
        error_message: error.message
      });
      
      toast({
        title: "Error",
        description: `Failed to send campaign: ${error.message}`,
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
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
    refetch: fetchCampaigns
  };
};
