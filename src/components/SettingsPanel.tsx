
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SMTPConfigForm from './SMTPConfigForm';
import AppsScriptConfigForm from './AppsScriptConfigForm';
import PowerMTAConfigForm from './PowerMTAConfigForm';
import GoogleCloudConfigForm from './GoogleCloudConfigForm';
import GoogleCloudSetupGuide from './GoogleCloudSetupGuide';
import { Separator } from "@/components/ui/separator";

const SettingsPanel = () => {
  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Campaign Settings</CardTitle>
          <p className="text-slate-600">Configure your email sending methods and preferences</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="smtp" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="smtp">SMTP</TabsTrigger>
              <TabsTrigger value="apps-script">Apps Script</TabsTrigger>
              <TabsTrigger value="powermta">PowerMTA</TabsTrigger>
              <TabsTrigger value="cloud-functions">Cloud Functions</TabsTrigger>
              <TabsTrigger value="setup-guide">Setup Guide</TabsTrigger>
            </TabsList>
            
            <TabsContent value="smtp" className="space-y-4">
              <SMTPConfigForm />
            </TabsContent>
            
            <TabsContent value="apps-script" className="space-y-4">
              <AppsScriptConfigForm />
            </TabsContent>
            
            <TabsContent value="powermta" className="space-y-4">
              <PowerMTAConfigForm />
            </TabsContent>
            
            <TabsContent value="cloud-functions" className="space-y-4">
              <GoogleCloudConfigForm />
            </TabsContent>
            
            <TabsContent value="setup-guide" className="space-y-4">
              <GoogleCloudSetupGuide />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
