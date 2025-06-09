
import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Demo Organization',
    subdomain: 'demo',
    subscription_plan: 'free',
    emails_sent_this_month: 0,
    monthly_email_limit: 1000
  });
  const [organizations] = useState<Organization[]>([
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Demo Organization',
      subdomain: 'demo',
      subscription_plan: 'free',
      emails_sent_this_month: 0,
      monthly_email_limit: 1000
    }
  ]);

  return (
    <SimpleOrganizationContext.Provider value={{
      currentOrganization,
      setCurrentOrganization,
      organizations
    }}>
      {children}
    </SimpleOrganizationContext.Provider>
  );
};
