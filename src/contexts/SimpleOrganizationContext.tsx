
import React, { createContext, useContext, ReactNode } from 'react';

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
  subdomain: string;
  domain?: string;
  is_active: boolean;
  monthly_email_limit: number;
  emails_sent_this_month: number;
}

interface SimpleOrganizationContextType {
  currentOrganization: Organization;
  organizations: Organization[];
  loading: boolean;
  createOrganization: (orgData: any) => Promise<Organization>;
  refetch: () => void;
}

const SimpleOrganizationContext = createContext<SimpleOrganizationContextType | undefined>(undefined);

const defaultOrganization: Organization = {
  id: 'demo-org-id',
  name: 'Demo Organization',
  subscription_plan: 'pro',
  subdomain: 'demo-org',
  is_active: true,
  monthly_email_limit: 10000,
  emails_sent_this_month: 0
};

export const SimpleOrganizationProvider = ({ children }: { children: ReactNode }) => {
  const createOrganization = async (orgData: any): Promise<Organization> => {
    // Return a mock organization for demo purposes
    return {
      ...defaultOrganization,
      id: `org-${Date.now()}`,
      name: orgData.name || 'New Organization',
      subdomain: orgData.subdomain || 'new-org'
    };
  };

  const refetch = () => {
    // No-op for demo mode
  };

  return (
    <SimpleOrganizationContext.Provider value={{
      currentOrganization: defaultOrganization,
      organizations: [defaultOrganization],
      loading: false,
      createOrganization,
      refetch
    }}>
      {children}
    </SimpleOrganizationContext.Provider>
  );
};

export const useSimpleOrganizations = () => {
  const context = useContext(SimpleOrganizationContext);
  if (context === undefined) {
    throw new Error('useSimpleOrganizations must be used within a SimpleOrganizationProvider');
  }
  return context;
};
