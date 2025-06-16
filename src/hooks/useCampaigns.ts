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
  selected_accounts?: string[]; // Made optional since it's stored in config
  selected_powermta_server?: string; // Made optional since it's stored in config
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

interface CampaignFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export const useCampaigns = (organizationId?: string) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const CAMPAIGNS_PER_PAGE = 8;

  // Helper function to count recipients properly
  const countRecipients = useCallback((recipientsText: string): number => {
    if (!recipientsText?.trim()) return 0;
    
    // Try different separators
    const separators = ['\n', ',', ';'];
    let maxCount = 0;
    
    for (const separator of separators) {
      if (recipientsText.includes(separator)) {
        const count = recipientsText
          .split(separator)
          .map(email => email.trim())
          .filter(email => email && email.includes('@')).length;
        maxCount = Math.max(maxCount, count);
      }
    }
    
    // If no separators found, check if it's a single valid email
    if (maxCount === 0) {
      const trimmed = recipientsText.trim();
      if (trimmed && trimmed.includes('@')) {
        maxCount = 1;
      }
    }
    
    return maxCount;
  }, []);

  const fetchCampaigns = useCallback(async (filters: CampaignFilters = {}) => {
    if (!organizationId) {
      setCampaigns([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const page = filters.page || currentPage;
      const limit = filters.limit || CAMPAIGNS_PER_PAGE;
      const search = filters.search !== undefined ? filters.search : searchTerm;
      
      console.log(`🔍 Fetching campaigns - Page: ${page}, Limit: ${limit}, Search: "${search}"`);
      
      let query = supabase
        .from('email_campaigns')
        .select(`
          id,
          organization_id,
          from_name,
          subject,
          recipients,
          html_content,
          text_content,
          send_method,
          status,
          sent_count,
          total_recipients,
          created_at,
          sent_at,
          error_message,
          completed_at,
          config,
          prepared_emails
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Add search filters
      if (search?.trim()) {
        query = query.or(`subject.ilike.%${search}%,from_name.ilike.%${search}%`);
      }

      // Add pagination
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Campaign fetch error:', error);
        throw error;
      }
      
      const typedCampaigns: Campaign[] = (data || []).map(campaign => {
        // FIXED: Ensure total_recipients is calculated correctly
        const recipientCount = campaign.total_recipients || countRecipients(campaign.recipients || '');
        
        // Extract selected_accounts and selected_powermta_server from config
        const config = campaign.config || {};
        
        return {
          ...campaign,
          total_recipients: recipientCount,
          config: config,
          prepared_emails: Array.isArray(campaign.prepared_emails) ? campaign.prepared_emails : [],
          selected_accounts: config.selected_accounts || [], // Extract from config
          selected_powermta_server: config.selected_powermta_server || undefined // Extract from config
        };
      });
      
      console.log(`✅ Loaded ${typedCampaigns.length} campaigns (Total: ${count})`);
      setCampaigns(typedCampaigns);
      setTotalCount(count || 0);
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
  }, [organizationId, currentPage, searchTerm, countRecipients]);

  // Memoize campaign operations
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
        // FIXED: Calculate recipient count before saving
        const recipientCount = countRecipients(campaignData.recipients);
        
        // Store selected_accounts and selected_powermta_server in config
        const config = {
          ...campaignData.config,
          selected_accounts: campaignData.selected_accounts || [],
          selected_powermta_server: campaignData.selected_powermta_server
        };
        
        console.log('🔧 Creating campaign with config:', config);
        console.log('📧 Recipients count:', recipientCount);

        const { data, error } = await supabase
          .from('email_campaigns')
          .insert([{
            organization_id: organizationId,
            from_name: campaignData.from_name,
            subject: campaignData.subject,
            recipients: campaignData.recipients,
            html_content: campaignData.html_content,
            text_content: campaignData.text_content,
            send_method: campaignData.send_method,
            status: campaignData.status,
            sent_count: campaignData.sent_count,
            total_recipients: recipientCount, // FIXED: Set correct count
            config: config,
            prepared_emails: campaignData.prepared_emails || []
          }])
          .select()
          .single();

        if (error) throw error;

        const typedCampaign: Campaign = {
          ...data,
          total_recipients: recipientCount,
          config: data.config || {},
          prepared_emails: Array.isArray(data.prepared_emails) ? data.prepared_emails : [],
          selected_accounts: config.selected_accounts || [],
          selected_powermta_server: config.selected_powermta_server
        };

        setCampaigns(prev => [typedCampaign, ...prev.slice(0, CAMPAIGNS_PER_PAGE - 1)]);
        setTotalCount(prev => prev + 1);
        
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
        // FIXED: Recalculate recipient count if recipients changed
        if (updates.recipients) {
          updates.total_recipients = countRecipients(updates.recipients);
        }

        // Update config if selected_accounts or selected_powermta_server changed
        let configUpdates = {};
        if (updates.selected_accounts !== undefined || updates.selected_powermta_server !== undefined) {
          const existingCampaign = campaigns.find(c => c.id === campaignId);
          configUpdates = {
            ...existingCampaign?.config,
            selected_accounts: updates.selected_accounts || existingCampaign?.selected_accounts || [],
            selected_powermta_server: updates.selected_powermta_server ?? existingCampaign?.selected_powermta_server
          };
        }

        const dbUpdates = {
          ...updates,
          config: Object.keys(configUpdates).length > 0 ? configUpdates : updates.config
        };
        
        // Remove frontend-only properties before sending to database
        delete dbUpdates.selected_accounts;
        delete dbUpdates.selected_powermta_server;

        console.log('🔧 Updating campaign with:', dbUpdates);

        const { data, error } = await supabase
          .from('email_campaigns')
          .update(dbUpdates)
          .eq('id', campaignId)
          .select()
          .single();

        if (error) throw error;

        const typedCampaign: Campaign = {
          ...data,
          config: data.config || {},
          prepared_emails: Array.isArray(data.prepared_emails) ? data.prepared_emails : [],
          selected_accounts: data.config?.selected_accounts || [],
          selected_powermta_server: data.config?.selected_powermta_server
        };

        setCampaigns(prev => prev.map(campaign => 
          campaign.id === campaignId ? typedCampaign : campaign
        ));

        console.log('✅ Campaign updated successfully');
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
        setTotalCount(prev => Math.max(0, prev - 1));
        
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
          selected_accounts: campaign.selected_accounts,
          selected_powermta_server: campaign.selected_powermta_server,
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
    },

    // Pagination and search functions
    nextPage: () => {
      const maxPage = Math.ceil(totalCount / CAMPAIGNS_PER_PAGE);
      if (currentPage < maxPage) {
        setCurrentPage(prev => prev + 1);
      }
    },

    prevPage: () => {
      if (currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    },

    setPage: (page: number) => {
      const maxPage = Math.ceil(totalCount / CAMPAIGNS_PER_PAGE);
      if (page >= 1 && page <= maxPage) {
        setCurrentPage(page);
      }
    },

    search: (term: string) => {
      setSearchTerm(term);
      setCurrentPage(1); // Reset to first page on search
    }
  }), [organizationId, campaigns, currentPage, totalCount, searchTerm, countRecipients]);

  // Fetch campaigns when dependencies change
  useEffect(() => {
    if (organizationId) {
      fetchCampaigns();
    }
  }, [organizationId, currentPage, searchTerm]);

  const pagination = useMemo(() => ({
    currentPage,
    totalPages: Math.ceil(totalCount / CAMPAIGNS_PER_PAGE),
    totalCount,
    hasNext: currentPage < Math.ceil(totalCount / CAMPAIGNS_PER_PAGE),
    hasPrev: currentPage > 1
  }), [currentPage, totalCount]);

  return {
    campaigns: campaigns || [],
    loading,
    error,
    pagination,
    searchTerm,
    ...campaignOperations,
    refetch: fetchCampaigns
  };
};
