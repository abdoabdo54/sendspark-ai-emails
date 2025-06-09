
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GoogleCloudConfigForm from './GoogleCloudConfigForm';
import AccountManagementPanel from './AccountManagementPanel';
import GlobalGoogleCloudConfig from './GlobalGoogleCloudConfig';
import { toast } from '@/hooks/use-toast';

const SettingsPanel = () => {
  const [globalCloudConfig, setGlobalCloudConfig] = useState({
    enabled: false,
    functionUrl: '',
    projectId: '',
    region: 'us-central1',
    functionName: 'sendEmailCampaign',
    defaultRateLimit: 3600,
    defaultBatchSize: 10
  });

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('emailCampaignSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.googleCloudFunctions) {
          setGlobalCloudConfig(prev => ({
            ...prev,
            ...parsed.googleCloudFunctions
          }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Campaign Settings</CardTitle>
          <p className="text-slate-600">Configure your email accounts, sending methods, and cloud functions</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="accounts">Email Accounts</TabsTrigger>
              <TabsTrigger value="cloud-functions">Cloud Functions</TabsTrigger>
              <TabsTrigger value="setup-guide">Setup Guide</TabsTrigger>
            </TabsList>
            
            <TabsContent value="accounts" className="space-y-4">
              <AccountManagementPanel />
            </TabsContent>
            
            <TabsContent value="cloud-functions" className="space-y-4">
              <GlobalGoogleCloudConfig />
            </TabsContent>
            
            <TabsContent value="setup-guide" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Google Cloud Functions Setup Guide</CardTitle>
                </CardHeader>
                <CardContent className="prose max-w-none">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold">Step 1: Create Google Cloud Project</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                        <li>Create a new project or select an existing one</li>
                        <li>Note your Project ID for configuration</li>
                        <li>Enable billing for your project</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">Step 2: Enable Required APIs</h3>
                      <p className="text-sm text-gray-600 mb-2">Run these commands in Cloud Shell:</p>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">Step 3: Deploy the Function</h3>
                      <p className="text-sm text-gray-600 mb-2">Create a directory and add the function code:</p>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`mkdir email-campaign-function && cd email-campaign-function
# Copy the function code from the project's google-cloud-function-example.js
# Then deploy:
gcloud functions deploy sendEmailCampaign \\
  --runtime nodejs20 \\
  --trigger-http \\
  --allow-unauthenticated \\
  --memory 1GB \\
  --timeout 540s \\
  --region us-central1 \\
  --set-env-vars SUPABASE_URL=YOUR_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY`}
                      </pre>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">Step 4: Configure in Application</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Go to the "Cloud Functions" tab above</li>
                        <li>Enable Google Cloud Functions</li>
                        <li>Enter your Project ID</li>
                        <li>The Function URL will auto-generate</li>
                        <li>Test the connection</li>
                        <li>Save the configuration</li>
                      </ol>
                    </div>

                    <div className="bg-blue-50 p-4 rounded">
                      <h4 className="font-semibold text-blue-800">Advanced Features</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
                        <li>Parallel processing with multiple accounts</li>
                        <li>Individual rate limiting per account (emails/second)</li>
                        <li>Round-robin rotation for FROM names and subjects</li>
                        <li>Separated campaign preparation and sending</li>
                        <li>PowerMTA-style pause/resume functionality</li>
                        <li>Unlimited email capacity with intelligent queuing</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
