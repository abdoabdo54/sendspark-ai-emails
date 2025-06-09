
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EmailComposer from "@/components/EmailComposer";
import CampaignHistory from "@/components/CampaignHistory";
import SettingsPanel from "@/components/SettingsPanel";
import SubscriberManager from "@/components/SubscriberManager";
import DashboardStats from "@/components/DashboardStats";
import AccountManager from "@/components/AccountManager";
import Header from "@/components/Header";
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface IndexProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Index = ({ activeTab, onTabChange }: IndexProps) => {
  const { currentOrganization, loading } = useSimpleOrganizations();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading organization...</p>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    // If activeTab is one of the header tabs, show EmailComposer
    if (['bulk', 'single', 'testing', 'analytics', 'accounts'].includes(activeTab)) {
      return <EmailComposer activeTab={activeTab} />;
    }
    
    // Otherwise show the local tab content
    switch (activeTab) {
      case 'accounts-local':
        return <AccountManager />;
      case 'subscribers':
        return <SubscriberManager />;
      case 'history':
        return <CampaignHistory />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <EmailComposer activeTab="bulk" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <Header activeTab={activeTab} onTabChange={onTabChange} />
      
      <div className="container mx-auto p-6">
        {/* Organization info */}
        {currentOrganization && (
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                Welcome to {currentOrganization.name}
              </h2>
              <p className="text-slate-600">
                Manage your email campaigns and subscribers
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
                {currentOrganization.subscription_plan.charAt(0).toUpperCase() + currentOrganization.subscription_plan.slice(1)} Plan
              </Badge>
              <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200">
                {currentOrganization.emails_sent_this_month.toLocaleString()} / {currentOrganization.monthly_email_limit.toLocaleString()} emails
              </Badge>
            </div>
          </div>
        )}

        {/* Dashboard Stats */}
        <DashboardStats />

        {/* Main Content */}
        <Card className="mt-6 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Campaign Management Center</CardTitle>
            <CardDescription className="text-blue-100">
              Create, schedule, and manage professional email campaigns with advanced features
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {renderMainContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
