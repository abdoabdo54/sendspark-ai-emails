
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Cloud, Code, Settings, Zap, AlertTriangle, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from '@/hooks/use-toast';

const GoogleCloudSetupGuide = () => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`
    });
  };

  const functionCode = `const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

functions.http('sendEmailCampaign', async (req, res) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(200).send('');
    return;
  }

  try {
    const { campaignId, emailsByAccount, supabaseUrl, supabaseKey } = req.body;
    
    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    console.log(\`Processing campaign \${campaignId} with \${Object.keys(emailsByAccount || {}).length} accounts\`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update campaign status to processing
    await supabase
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // Here you would implement your email sending logic
    // For now, we'll simulate processing
    console.log('Email campaign processing started successfully');

    res.set(corsHeaders);
    res.json({ 
      success: true, 
      message: 'Campaign processing started',
      campaignId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing campaign:', error);
    res.set(corsHeaders);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});`;

  const packageJson = `{
  "name": "email-campaign-function",
  "version": "1.0.0",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "@supabase/supabase-js": "^2.0.0"
  }
}`;

  const steps = [
    {
      title: "Create Google Cloud Project",
      description: "Set up your Google Cloud project and enable billing",
      details: [
        "Go to console.cloud.google.com",
        "Click 'Create Project' or select existing one",
        "Note your Project ID (you'll need this)",
        "Enable billing (required for Cloud Functions)",
        "Make sure you're in the correct project"
      ],
      warning: "Billing must be enabled to deploy Cloud Functions"
    },
    {
      title: "Enable Required APIs",
      description: "Enable Cloud Functions and Cloud Build APIs",
      details: [
        "Go to APIs & Services > Library",
        "Search and enable 'Cloud Functions API'",
        "Search and enable 'Cloud Build API'",
        "Search and enable 'Cloud Run API'",
        "Wait for APIs to be fully enabled (may take a few minutes)"
      ],
      code: `gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com`
    },
    {
      title: "Prepare Function Code",
      description: "Create the function files locally",
      details: [
        "Create a new folder: mkdir email-campaign-function",
        "Navigate to folder: cd email-campaign-function",
        "Create index.js file with the provided code",
        "Create package.json file with dependencies",
        "Test the files are created correctly"
      ]
    },
    {
      title: "Deploy the Function",
      description: "Deploy your function to Google Cloud",
      details: [
        "Open terminal in your function folder",
        "Make sure gcloud CLI is installed and authenticated",
        "Run the deployment command provided below",
        "Wait for deployment to complete (may take 5-10 minutes)",
        "Copy the function URL from the output"
      ],
      code: `gcloud functions deploy sendEmailCampaign \\
  --runtime nodejs20 \\
  --trigger-http \\
  --allow-unauthenticated \\
  --memory 1GB \\
  --timeout 540s \\
  --region us-central1 \\
  --set-env-vars SUPABASE_URL=https://kzatxttazxwqawefumed.supabase.co,SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
    },
    {
      title: "Get Function URL",
      description: "Copy the function URL for configuration",
      details: [
        "After deployment, copy the 'httpsTrigger.url' from output",
        "Or go to Cloud Functions in the console",
        "Click on your function name",
        "Go to 'Trigger' tab",
        "Copy the trigger URL",
        "URL format: https://us-central1-PROJECT_ID.cloudfunctions.net/sendEmailCampaign"
      ]
    },
    {
      title: "Configure in Application",
      description: "Add the function URL to your email campaign settings",
      details: [
        "Go to Settings > Cloud Functions tab",
        "Enable Google Cloud Functions",
        "Paste your function URL",
        "Test the connection",
        "Save the configuration"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <AlertTriangle className="w-5 h-5" />
            Important Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <ul className="space-y-2">
            <li>• Google Cloud account with billing enabled</li>
            <li>• Google Cloud CLI (gcloud) installed and authenticated</li>
            <li>• Your Supabase service role key (found in Project Settings > API)</li>
            <li>• Basic familiarity with terminal/command line</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Step-by-Step Setup Guide
          </CardTitle>
          <p className="text-sm text-slate-600">
            Follow these steps carefully to set up Google Cloud Functions for email campaigns
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold">
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                      <p className="text-slate-600 mb-3">{step.description}</p>
                    </div>
                    
                    {step.warning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">Warning:</span>
                        </div>
                        <p className="text-amber-700 mt-1">{step.warning}</p>
                      </div>
                    )}

                    <ul className="space-y-2">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>

                    {step.code && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">Command:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(step.code!, "Command")}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm overflow-x-auto">
                          <code>{step.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Function Code Files
          </CardTitle>
          <p className="text-sm text-slate-600">
            Copy these files to your function directory
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">index.js</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(functionCode, "Function code")}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <pre className="bg-slate-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
              <code>{functionCode}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">package.json</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(packageJson, "Package.json")}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <pre className="bg-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
              <code>{packageJson}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Expected Function URL Format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">Your function URL should look like this:</p>
            <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">
              https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/sendEmailCampaign
            </code>
            <p className="text-xs text-blue-600 mt-2">
              Replace YOUR_PROJECT_ID with your actual Google Cloud project ID
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting Common Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-red-600">Error: Billing not enabled</h4>
              <p className="text-sm text-slate-600">Solution: Enable billing in Google Cloud Console > Billing</p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">Error: APIs not enabled</h4>
              <p className="text-sm text-slate-600">Solution: Enable Cloud Functions, Cloud Build, and Cloud Run APIs</p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">Error: Permission denied</h4>
              <p className="text-sm text-slate-600">Solution: Run 'gcloud auth login' and ensure you have owner/editor role</p>
            </div>
            <div>
              <h4 className="font-medium text-red-600">Function timeout</h4>
              <p className="text-sm text-slate-600">Solution: Increase timeout in deployment command or reduce batch size</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleCloudSetupGuide;
