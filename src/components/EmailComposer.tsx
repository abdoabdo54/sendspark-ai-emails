
import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import Header from './Header';

const EmailComposer = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const [activeTab, setActiveTab] = useState('bulk');

  const renderContent = () => {
    switch (activeTab) {
      case 'bulk':
        return <BulkEmailComposer organizationId={currentOrganization.id} />;
      case 'single':
        return <SingleEmailComposer organizationId={currentOrganization.id} />;
      case 'testing':
        return <CampaignTesting />;
      case 'campaigns':
        // This will be handled by the Campaigns page
        window.location.href = '/campaigns';
        return null;
      case 'analytics':
        return <CampaignAnalytics />;
      case 'accounts':
        return <AccountManager />;
      case 'tools':
        // This will be handled by the Tools page
        window.location.href = '/tools';
        return null;
      default:
        return <BulkEmailComposer organizationId={currentOrganization.id} />;
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default EmailComposer;
