
import React, { createContext, useContext } from 'react';
import { useOrganizations } from '@/hooks/useOrganizations';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  subscription_plan: string;
  emails_sent_this_month: number;
  monthly_email_limit: number;
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
    createOrganization 
  } = useOrganizations();

  // Transform the organization data to match the interface
  const transformedCurrentOrganization = currentOrganization ? {
    id: currentOrganization.id,
    name: currentOrganization.name,
    subdomain: currentOrganization.subdomain,
    subscription_plan: currentOrganization.subscription_plan,
    emails_sent_this_month: currentOrganization.emails_sent_this_month,
    monthly_email_limit: currentOrganization.monthly_email_limit
  } : null;

  const transformedOrganizations = organizations.map(org => ({
    id: org.id,
    name: org.name,
    subdomain: org.subdomain,
    subscription_plan: org.subscription_plan,
    emails_sent_this_month: org.emails_sent_this_month,
    monthly_email_limit: org.monthly_email_limit
  }));

  return (
    <SimpleOrganizationContext.Provider value={{
      currentOrganization: transformedCurrentOrganization,
      setCurrentOrganization: () => {}, // Not needed since useOrganizations handles this
      organizations: transformedOrganizations,
      loading,
      createOrganization
    }}>
      {children}
    </SimpleOrganizationContext.Provider>
  );
};
