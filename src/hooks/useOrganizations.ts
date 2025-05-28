
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  settings: any;
  subscription_plan: string;
  monthly_email_limit: number;
  emails_sent_this_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  organization_id: string;
  role: 'super_admin' | 'org_admin' | 'campaign_manager' | 'content_creator' | 'viewer';
  organization: Organization;
}

export const useOrganizations = () => {
  const [organizations, setOrganizations] = useState<UserRole[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          organization_id,
          role,
          organization:organizations(*)
        `)
        .eq('is_active', true);

      if (error) throw error;

      const typedData = data?.map(item => ({
        organization_id: item.organization_id,
        role: item.role as 'super_admin' | 'org_admin' | 'campaign_manager' | 'content_creator' | 'viewer',
        organization: item.organization as Organization
      })) || [];

      setOrganizations(typedData);

      // Set first organization as current if none selected
      if (typedData.length > 0 && !currentOrganization) {
        setCurrentOrganization(typedData[0].organization);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (orgData: {
    name: string;
    subdomain: string;
    domain?: string;
  }) => {
    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([orgData])
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as org admin
      const { error: userError } = await supabase
        .from('organization_users')
        .insert([{
          organization_id: org.id,
          role: 'org_admin',
          joined_at: new Date().toISOString()
        }]);

      if (userError) throw userError;

      toast({
        title: "Success",
        description: "Organization created successfully"
      });

      fetchUserOrganizations();
      return org;
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive"
      });
      throw error;
    }
  };

  const switchOrganization = (org: Organization) => {
    setCurrentOrganization(org);
    localStorage.setItem('currentOrgId', org.id);
  };

  useEffect(() => {
    fetchUserOrganizations();
    
    // Try to restore current organization from localStorage
    const savedOrgId = localStorage.getItem('currentOrgId');
    if (savedOrgId) {
      const savedOrg = organizations.find(o => o.organization.id === savedOrgId);
      if (savedOrg) {
        setCurrentOrganization(savedOrg.organization);
      }
    }
  }, []);

  return {
    organizations,
    currentOrganization,
    loading,
    createOrganization,
    switchOrganization,
    refetch: fetchUserOrganizations
  };
};
