
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
      
      // Check if user has any roles/organizations
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          *,
          organizations (*)
        `)
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        
        // If no roles found, create a default organization
        if (rolesError.code === 'PGRST116' || !rolesData || rolesData.length === 0) {
          console.log('No roles found, creating default organization');
          await createDefaultOrganization();
          return;
        }
        throw rolesError;
      }

      if (!rolesData || rolesData.length === 0) {
        console.log('No organizations found, creating default');
        await createDefaultOrganization();
        return;
      }

      // Extract organizations and roles
      const orgs = rolesData
        .map((role: any) => role.organizations)
        .filter(Boolean)
        .filter((org: any) => org.is_active);

      const roles = rolesData.map((role: any) => ({
        id: role.id,
        user_id: role.user_id,
        organization_id: role.organization_id,
        role: role.role,
        created_at: role.created_at
      }));

      console.log('Found organizations:', orgs.length);
      setOrganizations(orgs);
      setUserRoles(roles);
      
      // Set current organization if not already set
      if (orgs.length > 0 && !currentOrganization) {
        // Try to restore from localStorage first
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = savedOrgId ? orgs.find((org: any) => org.id === savedOrgId) : null;
        setCurrentOrganization(savedOrg || orgs[0]);
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

      // Create user role as admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: user.id,
          organization_id: orgData.id,
          role: 'admin'
        }]);

      if (roleError) {
        console.error('Error creating user role:', roleError);
        throw roleError;
      }

      console.log('Created user role');

      setOrganizations([orgData]);
      setCurrentOrganization(orgData);
      setUserRoles([{
        id: '',
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

      // Create user role as admin
      await supabase
        .from('user_roles')
        .insert([{
          user_id: user.id,
          organization_id: data.id,
          role: 'admin'
        }]);

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
