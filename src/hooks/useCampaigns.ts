
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!organizationId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching campaigns with optimized query for org:', organizationId);
      
      // OPTIMIZED: Select only essential fields and limit results
      const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
          id,
          organization_id,
          from_name,
          subject,
          recipients,
          send_method,
          status,
          sent_count,
          total_recipients,
          created_at,
          sent_at,
          error_message,
          completed_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(25); // Reduced limit for better performance

      if (error) {
        console.error('❌ Campaign fetch error:', error);
        throw error;
      }
      
      const typedCampaigns: Campaign[] = (data || []).map(campaign => ({
        ...campaign,
        html_content: '', // Don't load heavy content initially
        text_content: '', // Don't load heavy content initially
        config: {},
        prepared_emails: []
      }));
      
      console.log(`✅ Loaded ${typedCampaigns.length} campaigns successfully`);
      setCampaigns(typedCampaigns);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      setError("Failed to load campaigns");
      toast({
        title: "Error",
        description: "Failed to load campaigns. Please try refreshing.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Memoize campaign operations to prevent unnecessary re-renders
  const campaignOperations = useMemo(() => ({
    createCampaign: async (campaignData: Omit<Campaign, 'id' | 'created_at' | 'organization_id'>) => {
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

        const typedCampaign: Campaign = {
          ...data,
          config: data.config || {},
          prepared_emails: Array.isArray(data.prepared_emails) ? data.prepared_emails : []
        };

        setCampaigns(prev => [typedCampaign, ...prev]);
        toast({
          title: "Success",
          description: "Campaign created successfully"
        });
        
        return typedCampaign;
      } catch (error: any) {
        console.error('Error creating campaign:', error);
        toast({
          title: "Error",
          description: `Failed to create campaign: ${error.message}`,
          variant: "destructive"
        });
        return null;
      }
    },

    updateCampaign: async (campaignId: string, updates: Partial<Campaign>) => {
      try {
        const { data, error } = await supabase
          .from('email_campaigns')
          .update(updates)
          .eq('id', campaignId)
          .select()
          .single();

        if (error) throw error;

        const typedCampaign: Campaign = {
          ...data,
          config: data.config || {},
          prepared_emails: Array.isArray(data.prepared_emails) ? data.prepared_emails : []
        };

        setCampaigns(prev => prev.map(campaign => 
          campaign.id === campaignId ? typedCampaign : campaign
        ));

        return typedCampaign;
      } catch (error) {
        console.error('Error updating campaign:', error);
        toast({
          title: "Error",
          description: "Failed to update campaign",
          variant: "destructive"
        });
        return null;
      }
    },

    deleteCampaign: async (campaignId: string) => {
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
    },

    duplicateCampaign: async (campaignId: string) => {
      try {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) {
          throw new Error('Campaign not found');
        }

        const duplicateData: Omit<Campaign, 'id' | 'created_at' | 'organization_id'> = {
          from_name: campaign.from_name,
          subject: `Copy of ${campaign.subject}`,
          recipients: campaign.recipients,
          html_content: campaign.html_content,
          text_content: campaign.text_content,
          send_method: campaign.send_method,
          status: 'draft',
          sent_count: 0,
          total_recipients: campaign.total_recipients,
          config: campaign.config,
          prepared_emails: [],
          sent_at: undefined,
          error_message: undefined,
          completed_at: undefined
        };

        return await campaignOperations.createCampaign(duplicateData);
      } catch (error) {
        console.error('Error duplicating campaign:', error);
        toast({
          title: "Error",
          description: "Failed to duplicate campaign",
          variant: "destructive"
        });
      }
    },

    pauseCampaign: async (campaignId: string) => {
      try {
        await campaignOperations.updateCampaign(campaignId, { status: 'paused' });
        toast({
          title: "Success",
          description: "Campaign paused successfully"
        });
      } catch (error) {
        console.error('Error pausing campaign:', error);
        toast({
          title: "Error",
          description: "Failed to pause campaign",
          variant: "destructive"
        });
      }
    },

    resumeCampaign: async (campaignId: string) => {
      try {
        await campaignOperations.updateCampaign(campaignId, { status: 'sending' });
        toast({
          title: "Success",
          description: "Campaign resumed successfully"
        });
      } catch (error) {
        console.error('Error resuming campaign:', error);
        toast({
          title: "Error",
          description: "Failed to resume campaign",
          variant: "destructive"
        });
      }
    }
  }), [organizationId, campaigns]);

  // Only fetch on mount or when organizationId changes
  useEffect(() => {
    if (organizationId) {
      fetchCampaigns();
    }
  }, [organizationId]); // Simplified dependency

  return {
    campaigns: campaigns || [],
    loading,
    error,
    ...campaignOperations,
    refetch: fetchCampaigns
  };
};
