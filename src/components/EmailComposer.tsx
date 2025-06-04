
import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from 'lucide-react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useOrganizations } from '@/hooks/useOrganizations';
import Header from './Header';

const EmailComposer = () => {
  const { currentOrganization } = useOrganizations();
  const [activeTab, setActiveTab] = useState('bulk');

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Mail className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Organization Required</h3>
                <p className="text-slate-600">Please select or create an organization to access the email composer.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="container mx-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default EmailComposer;
