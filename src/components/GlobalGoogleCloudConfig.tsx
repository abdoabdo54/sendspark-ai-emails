
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, TestTube, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GlobalGoogleCloudConfig {
  enabled: boolean;
  functionUrl: string;
  projectId: string;
  region: string;
  functionName: string;
  defaultRateLimit: number;
  defaultBatchSize: number;
}

interface GlobalGoogleCloudConfigProps {
  config: GlobalGoogleCloudConfig;
  onSave: (config: GlobalGoogleCloudConfig) => void;
  onTest?: (config: GlobalGoogleCloudConfig) => Promise<boolean>;
}

const GlobalGoogleCloudConfig: React.FC<GlobalGoogleCloudConfigProps> = ({ 
  config, 
  onSave, 
  onTest 
}) => {
  const [formData, setFormData] = useState<GlobalGoogleCloudConfig>(config);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleInputChange = (field: keyof GlobalGoogleCloudConfig, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-generate function URL when project ID or region changes
    if (field === 'projectId' || field === 'region') {
      const projectId = field === 'projectId' ? value : formData.projectId;
      const region = field === 'region' ? value : formData.region;
      const functionName = formData.functionName;
      
      if (projectId && region && functionName) {
        const generatedUrl = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
        setFormData(prev => ({
          ...prev,
          functionUrl: generatedUrl
        }));
      }
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const success = await onTest(formData);
      setTestResult({
        success,
        message: success 
          ? 'Google Cloud Function connection successful!' 
          : 'Failed to connect to Google Cloud Function'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (formData.enabled) {
      if (!formData.functionUrl || !formData.projectId) {
        toast({
          title: "Validation Error",
          description: "Function URL and Project ID are required when enabling Google Cloud Functions",
          variant: "destructive"
        });
        return;
      }
    }

    onSave(formData);
    toast({
      title: "Success",
      description: "Google Cloud Functions configuration saved successfully"
    });
  };

  const downloadSetupGuide = () => {
    // Create and download the setup guide
    const guideContent = `
# Google Cloud Functions Setup Guide for Email Campaigns

## Prerequisites
1. Google Cloud Platform account with billing enabled
2. Google Cloud CLI installed
3. Node.js 18+ installed

## Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create new project or select existing one
3. Note your Project ID: ${formData.projectId || 'your-project-id'}

## Step 2: Enable APIs
Run these commands in Cloud Shell or local terminal:
\`\`\`bash
gcloud config set project ${formData.projectId || 'your-project-id'}
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
\`\`\`

## Step 3: Prepare Function Code
1. Create directory: mkdir email-campaign-function && cd email-campaign-function
2. Create package.json:
\`\`\`json
{
  "name": "email-campaign-function",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0"
  }
}
\`\`\`

3. Copy the function code from google-cloud-function-example.js in your project

## Step 4: Deploy Function
\`\`\`bash
gcloud functions deploy ${formData.functionName} \\
  --runtime nodejs20 \\
  --trigger-http \\
  --allow-unauthenticated \\
  --memory 1GB \\
  --timeout 540s \\
  --region ${formData.region} \\
  --set-env-vars SUPABASE_URL=YOUR_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
\`\`\`

## Step 5: Get Function URL
After deployment, your function URL will be:
${formData.functionUrl || `https://${formData.region}-${formData.projectId || 'your-project-id'}.cloudfunctions.net/${formData.functionName}`}

## Step 6: Configure in App
1. Go to Settings > Cloud Functions
2. Enable Google Cloud Functions
3. Enter your Project ID: ${formData.projectId || 'your-project-id'}
4. Set Region: ${formData.region}
5. Function URL should auto-populate
6. Test connection
7. Save configuration

## Rate Limiting Configuration
- Default Rate Limit: ${formData.defaultRateLimit} emails/hour
- Default Batch Size: ${formData.defaultBatchSize} concurrent emails
- These can be adjusted per campaign or globally

## Benefits
✅ Handles 1000+ emails efficiently
✅ Respects rate limits across all accounts
✅ Supports both SMTP and Apps Script
✅ Real-time progress tracking
✅ Automatic error handling and retries

## Troubleshooting
1. Ensure billing is enabled on your GCP project
2. Check that all required APIs are enabled
3. Verify environment variables are set correctly
4. Check function logs in GCP Console for errors

## Cost Estimation
- Cloud Functions: ~$0.40 per 1M invocations
- For 1000 emails: approximately $0.001
- Very cost-effective for email campaigns
    `;

    const blob = new Blob([guideContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google-cloud-functions-setup-guide.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Enable Google Cloud Functions</Label>
          <p className="text-sm text-slate-600">Use Google Cloud Functions for high-speed email sending</p>
        </div>
        <Switch
          checked={formData.enabled}
          onCheckedChange={(checked) => handleInputChange('enabled', checked)}
        />
      </div>

      {formData.enabled && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project ID *</Label>
              <Input
                id="projectId"
                value={formData.projectId}
                onChange={(e) => handleInputChange('projectId', e.target.value)}
                placeholder="your-gcp-project-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                placeholder="us-central1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="functionName">Function Name</Label>
              <Input
                id="functionName"
                value={formData.functionName}
                onChange={(e) => handleInputChange('functionName', e.target.value)}
                placeholder="sendEmailCampaign"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultRateLimit">Default Rate Limit (emails/hour)</Label>
              <Input
                id="defaultRateLimit"
                type="number"
                min="1"
                max="3600"
                value={formData.defaultRateLimit}
                onChange={(e) => handleInputChange('defaultRateLimit', parseInt(e.target.value) || 3600)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="functionUrl">Function URL</Label>
            <Textarea
              id="functionUrl"
              value={formData.functionUrl}
              onChange={(e) => handleInputChange('functionUrl', e.target.value)}
              placeholder="https://us-central1-your-project.cloudfunctions.net/sendEmailCampaign"
              rows={2}
            />
            <p className="text-sm text-slate-600">
              URL is auto-generated when you enter Project ID and Region
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Need help setting up Google Cloud Functions?</span>
                <Button variant="outline" size="sm" onClick={downloadSetupGuide} className="ml-2">
                  <Download className="w-4 h-4 mr-2" />
                  Download Setup Guide
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {onTest && (
              <Button 
                variant="outline" 
                onClick={handleTest}
                disabled={isTesting || !formData.functionUrl}
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
            
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalGoogleCloudConfig;
