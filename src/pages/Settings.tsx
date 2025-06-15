
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SettingsPanel from '@/components/SettingsPanel';
import PowerMTAServerManager from '@/components/PowerMTAServerManager';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { Settings as SettingsIcon, Server, Zap, Shield, Globe } from 'lucide-react';

const Settings = () => {
  const { currentOrganization } = useSimpleOrganizations();

  if (!currentOrganization) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Please select an organization to view settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-8 h-8" />
            Settings
          </h1>
          <p className="text-slate-600 mt-2">
            Manage your organization settings and integrations
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="powermta" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              PowerMTA Servers
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <SettingsPanel />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="powermta">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  PowerMTA Servers
                  <Badge variant="secondary">Bridge Integration</Badge>
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Configure PowerMTA servers for distributed email sending. These servers act as a bridge 
                  to distribute campaigns using your SMTP and Apps Script sender accounts.
                </p>
              </CardHeader>
              <CardContent>
                <PowerMTAServerManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>Third-party Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Third-party integrations coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Security settings coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
