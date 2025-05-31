
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, Zap, BarChart3, Settings } from 'lucide-react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import { useOrganizations } from '@/hooks/useOrganizations';

const EmailComposer = () => {
  const { currentOrganization } = useOrganizations();
  const [activeTab, setActiveTab] = useState('bulk');

  if (!currentOrganization) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Mail className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Organization Required</h3>
            <p className="text-slate-600">Please select or create an organization to access the email composer.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Email Campaign Center</h1>
          <p className="text-slate-600">Professional email marketing and bulk sending platform</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {currentOrganization.name}
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {currentOrganization.subscription_plan.toUpperCase()}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Bulk Campaigns
          </TabsTrigger>
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Single Email
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk">
          <BulkEmailComposer organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="single">
          <SingleEmailComposer organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
              <CardDescription>
                Comprehensive analytics and reporting for your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Advanced Analytics Coming Soon</h3>
                <p className="text-sm">
                  Real-time tracking, delivery rates, open rates, click-through rates, and more
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>
                Configure global settings for your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Advanced Settings Coming Soon</h3>
                <p className="text-sm">
                  Global rate limits, default templates, compliance settings, and more
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailComposer;
