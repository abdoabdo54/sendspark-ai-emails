
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

  const createOrganization = async (orgData: {
    name: string;
    subdomain: string;
    domain?: string;
  }) => {
    // In demo mode, just simulate organization creation
    console.log('Creating organization:', orgData);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, we'll just log the creation
    // In a real app, this would make an API call to create the organization
    return mockOrganization;
  };

  return {
    currentOrganization,
    organizations: [mockOrganization],
    createOrganization
  };
};
