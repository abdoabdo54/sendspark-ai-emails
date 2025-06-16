
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Mail, Settings, BarChart3, TestTube, Users, Bot } from "lucide-react";
import EmailComposer from "@/components/EmailComposer";
import Header from "@/components/Header";
import DashboardStats from "@/components/DashboardStats";
import { useAuth } from "@/hooks/useAuth";
import { useSimpleOrganizations } from "@/contexts/SimpleOrganizationContext";

interface IndexProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Index = ({ activeTab, onTabChange }: IndexProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useSimpleOrganizations();

  const handleNavigateToSettings = () => {
    navigate('/settings');
  };

  const handleNavigateToCampaigns = () => {
    navigate('/campaigns');
  };

  const handleNavigateToFunctions = () => {
    navigate('/function-manager');
  };

  const handleNavigateToSmartConfig = () => {
    navigate('/smart-config');
  };

  if (!user || !currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-slate-600">Please select an organization to continue.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Stats */}
        <div className="mb-8">
          <DashboardStats />
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onTabChange('campaign')}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="w-5 h-5 text-blue-600" />
                Campaign Composer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Create professional email campaigns with advanced features</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleNavigateToCampaigns}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Campaign History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">View and manage your email campaigns</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleNavigateToFunctions}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="w-5 h-5 text-purple-600" />
                Function Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Manage Google Cloud Functions for email delivery</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleNavigateToSettings}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-gray-600" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Configure accounts and system settings</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="campaign" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Campaign Composer
            </TabsTrigger>
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Single Email
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              Testing Tools
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <EmailComposer activeTab={activeTab} />
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
