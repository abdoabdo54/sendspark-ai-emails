
import React, { createContext, useContext } from 'react';
import { useUserOrganizations } from '@/hooks/useUserOrganizations';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  subscription_plan: string;
  is_active: boolean;
  emails_sent_this_month: number;
  monthly_email_limit: number;
  created_at: string;
  updated_at: string;
}

interface SimpleOrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  organizations: Organization[];
  loading: boolean;
  createOrganization: (orgData: { name: string; subdomain: string; domain?: string }) => Promise<any>;
}

const SimpleOrganizationContext = createContext<SimpleOrganizationContextType | undefined>(undefined);

export const useSimpleOrganizations = () => {
  const context = useContext(SimpleOrganizationContext);
  if (!context) {
    throw new Error('useSimpleOrganizations must be used within SimpleOrganizationProvider');
  }
  return context;
};

export const SimpleOrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    currentOrganization, 
    organizations, 
    loading, 
    createOrganization,
    switchOrganization
  } = useUserOrganizations();

  // Transform the organization data to match the interface with all required properties
  const transformedCurrentOrganization = currentOrganization ? {
    id: currentOrganization.id,
    name: currentOrganization.name,
    subdomain: currentOrganization.subdomain,
    domain: currentOrganization.domain,
    subscription_plan: currentOrganization.subscription_plan,
    is_active: currentOrganization.is_active,
    emails_sent_this_month: currentOrganization.emails_sent_this_month,
    monthly_email_limit: currentOrganization.monthly_email_limit,
    created_at: currentOrganization.created_at,
    updated_at: currentOrganization.updated_at
  } : null;

  const transformedOrganizations = organizations.map(org => ({
    id: org.id,
    name: org.name,
    subdomain: org.subdomain,
    domain: org.domain,
    subscription_plan: org.subscription_plan,
    is_active: org.is_active,
    emails_sent_this_month: org.emails_sent_this_month,
    monthly_email_limit: org.monthly_email_limit,
    created_at: org.created_at,
    updated_at: org.updated_at
  }));

  return (
    <SimpleOrganizationContext.Provider value={{
      currentOrganization: transformedCurrentOrganization,
      setCurrentOrganization: switchOrganization,
      organizations: transformedOrganizations,
      loading,
      createOrganization
    }}>
      {children}
    </SimpleOrganizationContext.Provider>
  );
};
