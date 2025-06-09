
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
      
      // Use RPC function to get user organizations to avoid TypeScript issues
      const { data: orgsData, error: orgsError } = await supabase
        .rpc('get_user_organizations', { _user_id: user.id })
        .catch(() => {
          // Fallback if function doesn't exist yet
          return { data: null, error: { message: 'Function not found' } };
        });

      if (orgsError || !orgsData) {
        console.log('No organizations found or function not available, creating default');
        await createDefaultOrganization();
        return;
      }

      if (orgsData.length === 0) {
        console.log('No organizations found, creating default');
        await createDefaultOrganization();
        return;
      }

      // Extract organizations from the function result
      const orgs = orgsData.map((item: any) => ({
        id: item.org_id,
        name: item.org_name,
        subdomain: item.org_subdomain,
        domain: item.org_domain,
        subscription_plan: 'free',
        is_active: true,
        monthly_email_limit: 1000,
        emails_sent_this_month: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const roles = orgsData.map((item: any) => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: item.org_id,
        role: item.org_role,
        created_at: new Date().toISOString()
      }));

      console.log('Found organizations:', orgs.length);
      setOrganizations(orgs);
      setUserRoles(roles);
      
      // Set current organization if not already set
      if (orgs.length > 0 && !currentOrganization) {
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = savedOrgId ? orgs.find((org: any) => org.id === savedOrgId) : null;
        setCurrentOrganization(savedOrg || orgs[0]);
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
          emails_sent_this_month: 0,
          created_by: user.id,
          billing_email: user.email
        }])
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        throw orgError;
      }

      console.log('Created organization:', orgData);

      // Try to create user role using RPC function
      try {
        await supabase.rpc('create_user_role', {
          _user_id: user.id,
          _organization_id: orgData.id,
          _role: 'admin'
        });
      } catch (roleError) {
        console.error('Error creating user role:', roleError);
        // Continue anyway as the organization was created
      }

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
          emails_sent_this_month: 0,
          created_by: user.id,
          billing_email: user.email
        }])
        .select()
        .single();

      if (error) throw error;

      // Try to create user role
      try {
        await supabase.rpc('create_user_role', {
          _user_id: user.id,
          _organization_id: data.id,
          _role: 'admin'
        });
      } catch (roleError) {
        console.error('Error creating user role:', roleError);
        // Continue anyway as the organization was created
      }

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
