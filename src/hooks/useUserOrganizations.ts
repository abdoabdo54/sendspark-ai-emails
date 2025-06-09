
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  subscription_plan: string;
  is_active: boolean;
  monthly_email_limit: number;
  emails_sent_this_month: number;
  created_by?: string;
  billing_email?: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'super_admin' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

export const useUserOrganizations = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserOrganizations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching organizations for user:', user.id);
      
      // Try to get user organizations using the existing RPC function
      const { data: orgsData, error: orgsError } = await supabase
        .rpc('get_user_organizations', { user_id: user.id });

      if (orgsError || !orgsData) {
        console.log('No organizations found or function failed, creating default');
        await createDefaultOrganization();
        return;
      }

      if (orgsData.length === 0) {
        console.log('No organizations found, creating default');
        await createDefaultOrganization();
        return;
      }

      // For now, since we don't have proper organization data structure, 
      // let's use the existing organizations table directly
      const { data: directOrgs, error: directError } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true);

      if (directError) {
        console.error('Error fetching organizations directly:', directError);
        await createDefaultOrganization();
        return;
      }

      if (!directOrgs || directOrgs.length === 0) {
        await createDefaultOrganization();
        return;
      }

      console.log('Found organizations:', directOrgs.length);
      setOrganizations(directOrgs);
      
      // Create mock user roles for now
      const mockRoles = directOrgs.map((org: any) => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: org.id,
        role: 'admin' as const,
        created_at: new Date().toISOString()
      }));

      setUserRoles(mockRoles);
      
      // Set current organization if not already set
      if (directOrgs.length > 0 && !currentOrganization) {
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = savedOrgId ? directOrgs.find((org: any) => org.id === savedOrgId) : null;
        setCurrentOrganization(savedOrg || directOrgs[0]);
      }

    } catch (error) {
      console.error('Error fetching organizations:', error);
      // Try to create default organization if there's an error
      await createDefaultOrganization();
    } finally {
      setLoading(false);
    }
  };

  const createDefaultOrganization = async () => {
    if (!user) return;

    try {
      console.log('Creating default organization for user:', user.email);
      
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: `${user.email?.split('@')[0] || 'Default'}'s Organization`,
          subdomain: (user.email?.split('@')[0] || 'default-org').toLowerCase().replace(/[^a-z0-9-]/g, ''),
          subscription_plan: 'free',
          is_active: true,
          monthly_email_limit: 1000,
          emails_sent_this_month: 0
        }])
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        throw orgError;
      }

      console.log('Created organization:', orgData);

      setOrganizations([orgData]);
      setCurrentOrganization(orgData);
      setUserRoles([{
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: orgData.id,
        role: 'admin',
        created_at: new Date().toISOString()
      }]);

      toast({
        title: "Success",
        description: "Default organization created successfully"
      });

    } catch (error) {
      console.error('Error creating default organization:', error);
      toast({
        title: "Error",
        description: "Failed to create default organization",
        variant: "destructive"
      });
    }
  };

  const createOrganization = async (orgData: {
    name: string;
    subdomain: string;
    domain?: string;
  }) => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('organizations')
        .insert([{
          ...orgData,
          subscription_plan: 'free',
          is_active: true,
          monthly_email_limit: 1000,
          emails_sent_this_month: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setOrganizations(prev => [...prev, data]);
      setCurrentOrganization(data);
      
      toast({
        title: "Success",
        description: "Organization created successfully"
      });
      
      return data;
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = (organization: Organization) => {
    console.log('Switching to organization:', organization.name);
    setCurrentOrganization(organization);
    localStorage.setItem('currentOrganizationId', organization.id);
  };

  useEffect(() => {
    if (user) {
      fetchUserOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      setUserRoles([]);
      setLoading(false);
    }
  }, [user]);

  return {
    organizations,
    currentOrganization,
    userRoles,
    loading,
    createOrganization,
    switchOrganization,
    refetch: fetchUserOrganizations
  };
};
