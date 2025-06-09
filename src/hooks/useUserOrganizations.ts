
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
      // First, check if user has any organizations
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          *,
          organizations (*)
        `)
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        
        // If no roles found, create a default organization for the user
        if (rolesError.code === 'PGRST116' || !rolesData || rolesData.length === 0) {
          await createDefaultOrganization();
          return;
        }
        throw rolesError;
      }

      if (!rolesData || rolesData.length === 0) {
        // Create default organization if user has no organizations
        await createDefaultOrganization();
        return;
      }

      const orgs = rolesData.map((role: any) => role.organizations).filter(Boolean);
      const roles = rolesData.map((role: any) => ({
        id: role.id,
        user_id: role.user_id,
        organization_id: role.organization_id,
        role: role.role,
        created_at: role.created_at
      }));

      setOrganizations(orgs);
      setUserRoles(roles);
      
      if (orgs.length > 0 && !currentOrganization) {
        setCurrentOrganization(orgs[0]);
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
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: `${user.email}'s Organization`,
          subdomain: user.email?.split('@')[0] || 'default-org',
          subscription_plan: 'free',
          is_active: true,
          monthly_email_limit: 1000,
          emails_sent_this_month: 0,
          created_by: user.id,
          billing_email: user.email
        }])
        .select()
        .single();

      if (orgError) throw orgError;

      // Create user role as admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: user.id,
          organization_id: orgData.id,
          role: 'admin'
        }]);

      if (roleError) throw roleError;

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

  useEffect(() => {
    // Restore current organization from localStorage
    const savedOrgId = localStorage.getItem('currentOrganizationId');
    if (savedOrgId && organizations.length > 0) {
      const savedOrg = organizations.find(org => org.id === savedOrgId);
      if (savedOrg) {
        setCurrentOrganization(savedOrg);
      }
    }
  }, [organizations]);

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
