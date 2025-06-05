
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

// Use a proper UUID format instead of "demo-org-id"
const defaultOrganization: Organization = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Demo Organization',
  subscription_plan: 'pro',
  subdomain: 'demo-org',
  is_active: true,
  monthly_email_limit: 10000,
  emails_sent_this_month: 0
};

export const SimpleOrganizationProvider = ({ children }: { children: ReactNode }) => {
  const createOrganization = async (orgData: any): Promise<Organization> => {
    // Generate a proper UUID format for new organizations
    const newId = `${Date.now().toString(16).padStart(8, '0')}-${Math.random().toString(16).substr(2, 4)}-4${Math.random().toString(16).substr(2, 3)}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 12)}`;
    
    return {
      ...defaultOrganization,
      id: newId,
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
