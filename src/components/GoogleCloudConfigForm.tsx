
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GoogleCloudConfig {
  functionUrl: string;
  projectId: string;
  region: string;
  functionName: string;
  rateLimit: number;
  batchSize: number;
  enabled: boolean;
}

interface GoogleCloudConfigFormProps {
  config?: GoogleCloudConfig;
  onSave: (config: GoogleCloudConfig) => void;
  onTest?: (config: GoogleCloudConfig) => Promise<boolean>;
}

const GoogleCloudConfigForm: React.FC<GoogleCloudConfigFormProps> = ({ 
  config, 
  onSave, 
  onTest 
}) => {
  const [formData, setFormData] = useState<GoogleCloudConfig>({
    functionUrl: config?.functionUrl || '',
    projectId: config?.projectId || '',
    region: config?.region || 'us-central1',
    functionName: config?.functionName || 'send-email-campaign',
    rateLimit: config?.rateLimit || 60,
    batchSize: config?.batchSize || 10,
    enabled: config?.enabled || false
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleInputChange = (field: keyof GoogleCloudConfig, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    // Validation
    if (!formData.functionUrl) {
      toast({
        title: "Validation Error",
        description: "Function URL is required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.projectId) {
      toast({
        title: "Validation Error", 
        description: "Project ID is required",
        variant: "destructive"
      });
      return;
    }

    if (formData.rateLimit < 1 || formData.rateLimit > 3600) {
      toast({
        title: "Validation Error",
        description: "Rate limit must be between 1 and 3600 emails per hour",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-600" />
          <CardTitle>Google Cloud Functions Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure Google Cloud Functions for high-volume email sending with advanced rate limiting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enabled">Enable Google Cloud Functions</Label>
            <p className="text-sm text-slate-600">Use Google Cloud Functions for campaign sending</p>
          </div>
          <Switch
            id="enabled"
            checked={formData.enabled}
            onCheckedChange={(checked) => handleInputChange('enabled', checked)}
          />
        </div>

        {formData.enabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID</Label>
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
                  placeholder="send-email-campaign"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rateLimit">Rate Limit (emails/hour)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  min="1"
                  max="3600"
                  value={formData.rateLimit}
                  onChange={(e) => handleInputChange('rateLimit', parseInt(e.target.value) || 60)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.batchSize}
                  onChange={(e) => handleInputChange('batchSize', parseInt(e.target.value) || 10)}
                />
                <p className="text-sm text-slate-600">Number of emails to process in each batch</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="functionUrl">Function URL</Label>
              <Textarea
                id="functionUrl"
                value={formData.functionUrl}
                onChange={(e) => handleInputChange('functionUrl', e.target.value)}
                placeholder="https://us-central1-your-project.cloudfunctions.net/send-email-campaign"
                rows={3}
              />
              <p className="text-sm text-slate-600">
                Full URL of your deployed Google Cloud Function
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Make sure your Google Cloud Function is deployed and has the proper IAM permissions. 
                The function should accept POST requests with campaign data and handle email sending with rate limiting.
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
      </CardContent>
    </Card>
  );
};

export default GoogleCloudConfigForm;
