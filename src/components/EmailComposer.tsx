
import { useState } from 'react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'bulk' }: EmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();

  const renderContent = () => {
    switch (activeTab) {
      case 'bulk':
        return <BulkEmailComposer organizationId={currentOrganization.id} />;
      case 'single':
        return <SingleEmailComposer organizationId={currentOrganization.id} />;
      case 'testing':
        return <CampaignTesting />;
      case 'analytics':
        return <CampaignAnalytics />;
      case 'accounts':
        return <AccountManager />;
      default:
        return <BulkEmailComposer organizationId={currentOrganization.id} />;
    }
  };

  return (
    <div className="w-full">
      {renderContent()}
    </div>
  );
};

export default EmailComposer;
