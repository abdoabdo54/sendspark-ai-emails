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
      
      // Use the new function to get organizations with roles
      const { data: orgsData, error: orgsError } = await supabase
        .rpc('get_user_organizations_with_roles', { user_id_param: user.id });

      if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
        await createDefaultOrganization();
        return;
      }

      if (!orgsData || orgsData.length === 0) {
        console.log('No organizations found, creating default');
        await createDefaultOrganization();
        return;
      }

      // Transform the data to match our interface
      const transformedOrgs = orgsData.map((org: any) => ({
        id: org.org_id,
        name: org.org_name,
        subdomain: org.org_subdomain,
        domain: org.org_domain,
        subscription_plan: org.subscription_plan,
        is_active: org.is_active,
        monthly_email_limit: org.monthly_email_limit,
        emails_sent_this_month: org.emails_sent_this_month,
        created_at: org.created_at,
        updated_at: org.created_at
      }));

      const transformedRoles = orgsData.map((org: any) => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: org.org_id,
        role: org.user_role,
        created_at: org.created_at
      }));

      console.log('Found organizations:', transformedOrgs.length);
      setOrganizations(transformedOrgs);
      setUserRoles(transformedRoles);
      
      // Set current organization if not already set
      if (transformedOrgs.length > 0 && !currentOrganization) {
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = savedOrgId ? transformedOrgs.find((org: any) => org.id === savedOrgId) : null;
        setCurrentOrganization(savedOrg || transformedOrgs[0]);
      }

    } catch (error) {
      console.error('Error fetching organizations:', error);
      await createDefaultOrganization();
    } finally {
      setLoading(false);
    }
  };

  const createDefaultOrganization = async () => {
    if (!user) return;

    try {
      console.log('Creating default organization for user:', user.email);
      
      const orgName = `${user.email?.split('@')[0] || 'Default'}'s Organization`;
      const orgSubdomain = (user.email?.split('@')[0] || 'default-org').toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      // Use the new function to create organization with user role
      const { data: orgId, error: orgError } = await supabase
        .rpc('create_organization_with_user', {
          user_id_param: user.id,
          org_name: orgName,
          org_subdomain: orgSubdomain
        });

      if (orgError) {
        console.error('Error creating organization:', orgError);
        throw orgError;
      }

      console.log('Created organization with ID:', orgId);

      // Fetch the created organization
      const { data: newOrg, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (fetchError) {
        console.error('Error fetching created organization:', fetchError);
        throw fetchError;
      }

      setOrganizations([newOrg]);
      setCurrentOrganization(newOrg);
      setUserRoles([{
        id: crypto.randomUUID(),
        user_id: user.id,
        organization_id: orgId,
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
      
      // Use the new function to create organization with user role
      const { data: orgId, error: orgError } = await supabase
        .rpc('create_organization_with_user', {
          user_id_param: user.id,
          org_name: orgData.name,
          org_subdomain: orgData.subdomain,
          org_domain: orgData.domain || null
        });

      if (orgError) throw orgError;

      // Fetch the created organization
      const { data: newOrg, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (fetchError) throw fetchError;

      setOrganizations(prev => [...prev, newOrg]);
      setCurrentOrganization(newOrg);
      
      toast({
        title: "Success",
        description: "Organization created successfully"
      });
      
      return newOrg;
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

  const updateOrganization = async (orgId: string, updateData: Partial<Organization>) => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;

      setOrganizations(prev => prev.map(org => org.id === orgId ? data : org));
      if (currentOrganization?.id === orgId) {
        setCurrentOrganization(data);
      }
      
      toast({
        title: "Success",
        description: "Organization updated successfully"
      });
      
      return data;
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: "Error",
        description: "Failed to update organization",
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
    updateOrganization,
    switchOrganization,
    refetch: fetchUserOrganizations
  };
};
