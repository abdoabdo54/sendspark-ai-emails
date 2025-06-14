
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SimpleOrganization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  subscription_plan: string;
  is_active: boolean;
  monthly_email_limit: number;
  emails_sent_this_month: number;
  created_at: string;
}

interface SimpleOrganizationContextType {
  organizations: SimpleOrganization[];
  currentOrganization: SimpleOrganization | null;
  loading: boolean;
  error: string | null;
  setCurrentOrganization: (org: SimpleOrganization | null) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string, subdomain: string) => Promise<SimpleOrganization | null>;
}

const SimpleOrganizationContext = createContext<SimpleOrganizationContextType | undefined>(undefined);

export const useSimpleOrganizations = () => {
  const context = useContext(SimpleOrganizationContext);
  if (!context) {
    throw new Error('useSimpleOrganizations must be used within a SimpleOrganizationProvider');
  }
  return context;
};

interface SimpleOrganizationProviderProps {
  children: ReactNode;
}

export const SimpleOrganizationProvider: React.FC<SimpleOrganizationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<SimpleOrganization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<SimpleOrganization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    if (!user?.id || loading) {
      return;
    }

    // Prevent duplicate calls for the same user
    if (lastUserId === user.id && initialized) {
      console.log('⏭️ Skipping duplicate organization fetch for user:', user.id);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching organizations for user:', user.id);

      const { data, error } = await supabase
        .rpc('get_user_organizations_with_roles', {
          user_id_param: user.id
        });

      if (error) {
        console.error('❌ Error fetching organizations:', error);
        throw error;
      }

      const orgs: SimpleOrganization[] = (data || []).map((org: any) => ({
        id: org.org_id,
        name: org.org_name,
        subdomain: org.org_subdomain,
        domain: org.org_domain,
        subscription_plan: org.subscription_plan,
        is_active: org.is_active,
        monthly_email_limit: org.monthly_email_limit,
        emails_sent_this_month: org.emails_sent_this_month,
        created_at: org.created_at
      }));

      console.log(`✅ Found ${orgs.length} organizations`);
      setOrganizations(orgs);
      setLastUserId(user.id);

      // Auto-select first organization if none selected and organizations exist
      if (!currentOrganization && orgs.length > 0) {
        setCurrentOrganization(orgs[0]);
        console.log('🎯 Auto-selected organization:', orgs[0].name);
      }

    } catch (error: any) {
      console.error('❌ Failed to fetch organizations:', error);
      setError(error.message || 'Failed to fetch organizations');
      
      // Only show toast for first load or explicit refresh
      if (!initialized) {
        toast({
          title: "Error",
          description: "Failed to load organizations",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const createOrganization = async (name: string, subdomain: string): Promise<SimpleOrganization | null> => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data: orgId, error } = await supabase
        .rpc('create_organization_with_user', {
          user_id_param: user.id,
          org_name: name,
          org_subdomain: subdomain
        });

      if (error) {
        console.error('❌ Error creating organization:', error);
        throw error;
      }

      // Refresh organizations to get the new one
      await fetchOrganizations();
      
      const newOrg = organizations.find(org => org.id === orgId);
      if (newOrg) {
        setCurrentOrganization(newOrg);
        toast({
          title: "Success",
          description: "Organization created successfully"
        });
        return newOrg;
      }

      return null;
    } catch (error: any) {
      console.error('❌ Failed to create organization:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive"
      });
      return null;
    }
  };

  // Only fetch organizations when user changes and not already fetched
  useEffect(() => {
    if (user?.id && !initialized && !loading && lastUserId !== user.id) {
      fetchOrganizations();
    } else if (!user?.id) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setInitialized(false);
      setLastUserId(null);
    }
  }, [user?.id, initialized, loading, lastUserId]);

  const value: SimpleOrganizationContextType = {
    organizations,
    currentOrganization,
    loading,
    error,
    setCurrentOrganization,
    refreshOrganizations: fetchOrganizations,
    createOrganization
  };

  return (
    <SimpleOrganizationContext.Provider value={value}>
      {children}
    </SimpleOrganizationContext.Provider>
  );
};
