
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
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sent_count: number;
  total_recipients: number;
  created_at: string;
  sent_at?: string;
}

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
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

  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'created_at' | 'status' | 'sent_count' | 'total_recipients'>) => {
    try {
      const recipientCount = campaignData.recipients.split(',').filter(email => email.trim()).length;
      
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert([{
          ...campaignData,
          total_recipients: recipientCount,
          status: 'draft'
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
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive"
      });
      throw error;
    }
  };

  const sendCampaign = async (campaignId: string) => {
    try {
      // Update campaign status to sending
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // Call edge function to send emails
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: { campaignId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Campaign is being sent"
      });

      // Refresh campaigns to get updated status
      fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast({
        title: "Error",
        description: "Failed to send campaign",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return {
    campaigns,
    loading,
    createCampaign,
    sendCampaign,
    refetch: fetchCampaigns
  };
};
