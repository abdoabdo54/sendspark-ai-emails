
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon } from 'lucide-react';
import SettingsPanel from '../components/SettingsPanel';
import GoogleCloudSetupGuide from '../components/GoogleCloudSetupGuide';

const Settings = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
          </div>
          <p className="text-slate-600">
            Configure your email campaign application preferences and integrations
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="configuration" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
                <TabsTrigger value="setup-guide">Setup Guide</TabsTrigger>
              </TabsList>
              
              <TabsContent value="configuration">
                <SettingsPanel />
              </TabsContent>
              
              <TabsContent value="setup-guide">
                <GoogleCloudSetupGuide />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
