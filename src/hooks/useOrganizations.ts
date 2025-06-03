
import { useState } from 'react';

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
}

const mockOrganization: Organization = {
  id: 'demo-org',
  name: 'Demo Organization',
  subscription_plan: 'pro'
};

export const useOrganizations = () => {
  const [currentOrganization] = useState<Organization>(mockOrganization);

  return {
    currentOrganization,
    organizations: [mockOrganization]
  };
};
