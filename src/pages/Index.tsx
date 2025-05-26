
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import EmailComposer from "@/components/EmailComposer";
import AccountManager from "@/components/AccountManager";
import CampaignHistory from "@/components/CampaignHistory";
import SettingsPanel from "@/components/SettingsPanel";
import DashboardStats from "@/components/DashboardStats";
import { Mail, Settings, History, Users } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState("compose");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Email Campaign Manager</h1>
          <p className="text-slate-600">Professional multi-sender email campaigns with AI-powered features</p>
        </div>

        {/* Dashboard Stats */}
        <DashboardStats />

        {/* Main Interface */}
        <Card className="mt-6">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Campaign Management</CardTitle>
            <CardDescription className="text-blue-100">
              Create, manage, and send professional email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-white border-b">
                <TabsTrigger 
                  value="compose" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Mail className="w-4 h-4" />
                  Compose
                </TabsTrigger>
                <TabsTrigger 
                  value="accounts" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Users className="w-4 h-4" />
                  Accounts
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="p-6">
                <EmailComposer />
              </TabsContent>

              <TabsContent value="accounts" className="p-6">
                <AccountManager />
              </TabsContent>

              <TabsContent value="history" className="p-6">
                <CampaignHistory />
              </TabsContent>

              <TabsContent value="settings" className="p-6">
                <SettingsPanel />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
