
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, 
  Settings, 
  BarChart3, 
  TestTube, 
  Users, 
  Send,
  Wrench
} from 'lucide-react';
import OrganizationSetup from './OrganizationSetup';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrganizations();

  const handleTabClick = (tab: string) => {
    console.log('Tab clicked:', tab);
    
    // Handle navigation based on tab
    switch (tab) {
      case 'bulk':
      case 'single':
      case 'accounts':
      case 'testing':
      case 'analytics':
        navigate('/');
        onTabChange(tab);
        break;
      case 'campaigns':
        navigate('/campaigns');
        break;
      case 'tools':
        navigate('/tools');
        break;
      default:
        onTabChange(tab);
    }
  };

  // Determine active tab based on current route
  const getCurrentTab = () => {
    if (location.pathname === '/campaigns') return 'campaigns';
    if (location.pathname === '/tools') return 'tools';
    return activeTab;
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">EmailCampaign Pro</h1>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Professional Edition
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            {currentOrganization && (
              <div className="text-right">
                <p className="text-sm text-slate-600">Organization</p>
                <p className="font-medium text-slate-900">{currentOrganization.name}</p>
              </div>
            )}
            <OrganizationSetup />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Tabs value={getCurrentTab()} onValueChange={handleTabClick} className="flex-1">
            <TabsList className="grid w-full grid-cols-7 bg-slate-50">
              <TabsTrigger 
                value="bulk" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Send className="w-4 h-4" />
                Bulk Email
              </TabsTrigger>
              <TabsTrigger 
                value="single" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Mail className="w-4 h-4" />
                Single Email
              </TabsTrigger>
              <TabsTrigger 
                value="testing" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <TestTube className="w-4 h-4" />
                Testing
              </TabsTrigger>
              <TabsTrigger 
                value="campaigns" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <BarChart3 className="w-4 h-4" />
                Campaigns
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="accounts" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Settings className="w-4 h-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger 
                value="tools" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Wrench className="w-4 h-4" />
                Tools
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </header>
  );
};

export default Header;
