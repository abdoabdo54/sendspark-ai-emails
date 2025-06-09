
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, CheckCircle, Cloud, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const GoogleCloudSetupGuide: React.FC = () => {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyToClipboard = async (text: string, stepId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(stepId);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard"
      });
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const functionCode = `const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

functions.http('sendEmailCampaign', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  try {
    const { campaignId, preparedEmails, rateLimit, batchSize } = req.body;
    
    console.log(\`Processing campaign \${campaignId} with \${preparedEmails.length} emails\`);
    
    // Process emails in batches with rate limiting
    const emailsPerSecond = rateLimit / 3600; // Convert hourly to per second
    const delay = 1000 / emailsPerSecond; // Delay between emails in ms
    
    let sentCount = 0;
    
    for (let i = 0; i < preparedEmails.length; i += batchSize) {
      const batch = preparedEmails.slice(i, i + batchSize);
      
      // Process batch
      await Promise.all(batch.map(async (email) => {
        try {
          // Send email logic here (implement your email provider)
          console.log(\`Sending email to: \${email.to}\`);
          
          // Update progress in Supabase
          await supabase
            .from('email_campaigns')
            .update({ 
              sent_count: sentCount + 1,
              status: sentCount + 1 >= preparedEmails.length ? 'sent' : 'sending'
            })
            .eq('id', campaignId);
            
          sentCount++;
        } catch (error) {
          console.error(\`Failed to send email to \${email.to}:\`, error);
        }
      }));
      
      // Rate limiting delay
      if (i + batchSize < preparedEmails.length) {
        await new Promise(resolve => setTimeout(resolve, delay * batchSize));
      }
    }
    
    res.json({ 
      success: true, 
      message: \`Campaign completed. Sent \${sentCount} emails.\`,
      sentCount 
    });
  } catch (error) {
    console.error('Campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});`;

  const packageJson = `{
  "name": "email-campaign-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "@supabase/supabase-js": "^2.0.0"
  }
}`;

  const deployCommand = `gcloud functions deploy sendEmailCampaign \\
  --runtime nodejs20 \\
  --trigger-http \\
  --allow-unauthenticated \\
  --memory 1GB \\
  --timeout 540s \\
  --region us-central1 \\
  --set-env-vars SUPABASE_URL=YOUR_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`;

  const downloadSetupFiles = () => {
    // Create and download package.json
    const packageBlob = new Blob([packageJson], { type: 'application/json' });
    const packageUrl = URL.createObjectURL(packageBlob);
    const packageLink = document.createElement('a');
    packageLink.href = packageUrl;
    packageLink.download = 'package.json';
    packageLink.click();
    URL.revokeObjectURL(packageUrl);

    // Create and download index.js
    const indexBlob = new Blob([functionCode], { type: 'text/javascript' });
    const indexUrl = URL.createObjectURL(indexBlob);
    const indexLink = document.createElement('a');
    indexLink.href = indexUrl;
    indexLink.download = 'index.js';
    indexLink.click();
    URL.revokeObjectURL(indexUrl);

    toast({
      title: "Files Downloaded",
      description: "package.json and index.js downloaded successfully"
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-600" />
            Google Cloud Functions Setup Guide
          </CardTitle>
          <CardDescription>
            Follow these steps to set up Google Cloud Functions for high-speed email sending
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Need the setup files? Download them to get started quickly.</span>
                <Button variant="outline" size="sm" onClick={downloadSetupFiles} className="ml-2">
                  <Download className="w-4 h-4 mr-2" />
                  Download Setup Files
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="prerequisites" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="prerequisites">Prerequisites</TabsTrigger>
              <TabsTrigger value="setup">Setup Project</TabsTrigger>
              <TabsTrigger value="deploy">Deploy Function</TabsTrigger>
              <TabsTrigger value="configure">Configure App</TabsTrigger>
            </TabsList>

            <TabsContent value="prerequisites" className="space-y-4">
              <h3 className="text-lg font-semibold">Before You Start</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">1</Badge>
                  <div>
                    <p className="font-medium">Google Cloud Platform Account</p>
                    <p className="text-sm text-slate-600">Create a free account at console.cloud.google.com with billing enabled</p>
                    <Button variant="link" size="sm" asChild className="p-0 h-auto">
                      <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Open Google Cloud Console
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">2</Badge>
                  <div>
                    <p className="font-medium">Google Cloud CLI</p>
                    <p className="text-sm text-slate-600">Install the gcloud CLI tool on your computer</p>
                    <Button variant="link" size="sm" asChild className="p-0 h-auto">
                      <a href="https://cloud.google.com/sdk/docs/install" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Install gcloud CLI
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">3</Badge>
                  <div>
                    <p className="font-medium">Node.js 18+</p>
                    <p className="text-sm text-slate-600">Required for the Cloud Function runtime</p>
                    <Button variant="link" size="sm" asChild className="p-0 h-auto">
                      <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Download Node.js
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="setup" className="space-y-4">
              <h3 className="text-lg font-semibold">Project Setup</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-2">1. Create a new Google Cloud Project</p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm">
                    gcloud projects create email-campaign-functions
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('gcloud projects create email-campaign-functions', 'create-project')}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedStep === 'create-project' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div>
                  <p className="font-medium mb-2">2. Set the project as active</p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm">
                    gcloud config set project email-campaign-functions
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('gcloud config set project email-campaign-functions', 'set-project')}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedStep === 'set-project' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div>
                  <p className="font-medium mb-2">3. Enable required APIs</p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm space-y-1">
                    <div>gcloud services enable cloudfunctions.googleapis.com</div>
                    <div>gcloud services enable cloudbuild.googleapis.com</div>
                    <div>gcloud services enable run.googleapis.com</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('gcloud services enable cloudfunctions.googleapis.com\ngcloud services enable cloudbuild.googleapis.com\ngcloud services enable run.googleapis.com', 'enable-apis')}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedStep === 'enable-apis' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div>
                  <p className="font-medium mb-2">4. Create function directory</p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm">
                    mkdir email-campaign-function && cd email-campaign-function
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('mkdir email-campaign-function && cd email-campaign-function', 'create-dir')}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedStep === 'create-dir' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="deploy" className="space-y-4">
              <h3 className="text-lg font-semibold">Deploy the Function</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-2">1. Deploy the function</p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm whitespace-pre-wrap">
                    {deployCommand}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(deployCommand, 'deploy')}
                    className="mt-2"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copiedStep === 'deploy' ? 'Copied!' : 'Copy'}
                  </Button>
                  <p className="text-sm text-slate-600 mt-2">
                    Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY with your actual values
                  </p>
                </div>

                <div>
                  <p className="font-medium mb-2">2. Get the function URL</p>
                  <p className="text-sm text-slate-600">
                    After deployment, your function will be available at:
                  </p>
                  <div className="bg-slate-100 p-3 rounded-md font-mono text-sm">
                    https://us-central1-email-campaign-functions.cloudfunctions.net/sendEmailCampaign
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="configure" className="space-y-4">
              <h3 className="text-lg font-semibold">Configure the Application</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">1</Badge>
                  <div>
                    <p className="font-medium">Go to Settings</p>
                    <p className="text-sm text-slate-600">Navigate to Settings → Cloud Functions in your app</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">2</Badge>
                  <div>
                    <p className="font-medium">Enable Google Cloud Functions</p>
                    <p className="text-sm text-slate-600">Turn on the toggle for Google Cloud Functions</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">3</Badge>
                  <div>
                    <p className="font-medium">Enter Configuration</p>
                    <p className="text-sm text-slate-600">
                      Project ID: email-campaign-functions<br />
                      Region: us-central1<br />
                      Function Name: sendEmailCampaign
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">4</Badge>
                  <div>
                    <p className="font-medium">Test Connection</p>
                    <p className="text-sm text-slate-600">Use the test button to verify everything works</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">5</Badge>
                  <div>
                    <p className="font-medium">Save Configuration</p>
                    <p className="text-sm text-slate-600">Save the settings to start using Google Cloud Functions</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleCloudSetupGuide;
