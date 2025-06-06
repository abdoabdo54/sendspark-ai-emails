
import { useState } from 'react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'bulk' }: EmailComposerProps) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'bulk':
        return <BulkEmailComposer />;
      case 'single':
        return <SingleEmailComposer />;
      case 'testing':
        return <CampaignTesting />;
      case 'analytics':
        return <CampaignAnalytics />;
      case 'accounts':
        return <AccountManager />;
      default:
        return <BulkEmailComposer />;
    }
  };

  return (
    <div className="w-full">
      {renderContent()}
    </div>
  );
};

export default EmailComposer;
