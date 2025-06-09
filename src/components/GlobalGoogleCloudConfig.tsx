
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface GoogleCloudConfig {
  enabled: boolean;
  functionUrl: string;
  defaultRateLimit: number;
  defaultBatchSize: number;
}

const GlobalGoogleCloudConfig = () => {
  const [config, setConfig] = useState<GoogleCloudConfig>({
    enabled: false,
    functionUrl: 'https://email-campaign-function-357731264915.us-central1.run.app',
    defaultRateLimit: 3600,
    defaultBatchSize: 10
  });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Load saved configuration
  useEffect(() => {
    const savedConfig = localStorage.getItem('emailCampaignSettings');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.googleCloudFunctions) {
          setConfig(parsed.googleCloudFunctions);
        }
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }
  }, []);

  const handleSave = () => {
    try {
      const existingSettings = localStorage.getItem('emailCampaignSettings');
      const settings = existingSettings ? JSON.parse(existingSettings) : {};
      
      settings.googleCloudFunctions = config;
      localStorage.setItem('emailCampaignSettings', JSON.stringify(settings));
      
      toast({
        title: "Configuration Saved",
        description: "Google Cloud Functions settings have been saved successfully."
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    }
  };

  const handleTest = async () => {
    if (!config.functionUrl) {
      toast({
        title: "Error",
        description: "Please enter a function URL first",
        variant: "destructive"
      });
      return;
    }

    setConnectionStatus('testing');
    setIsLoading(true);

    try {
      // Test with a simple ping request
      const response = await fetch(config.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          message: 'Connection test from email campaign system'
        })
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Google Cloud Functions"
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Connection Failed",
          description: `HTTP ${response.status}: ${response.statusText}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Google Cloud test error:', error);
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Failed to connect to Google Cloud Functions. Please check the URL and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'testing':
        return 'Testing connection...';
      case 'success':
        return 'Connected';
      case 'error':
        return 'Connection failed';
      default:
        return config.enabled ? 'Ready' : 'Disabled';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Google Cloud Functions Configuration
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant={connectionStatus === 'success' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText()}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="gcf-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
          />
          <Label htmlFor="gcf-enabled">Enable Google Cloud Functions for high-volume sending</Label>
        </div>

        {config.enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="function-url">Cloud Function URL</Label>
              <div className="flex gap-2">
                <Input
                  id="function-url"
                  type="url"
                  value={config.functionUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, functionUrl: e.target.value }))}
                  placeholder="https://your-function-url.run.app"
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isLoading || !config.functionUrl}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Enter your deployed Google Cloud Functions URL from the screenshot
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rate-limit">Default Rate Limit (emails/hour)</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min="1"
                  max="36000"
                  value={config.defaultRateLimit}
                  onChange={(e) => setConfig(prev => ({ ...prev, defaultRateLimit: parseInt(e.target.value) || 3600 }))}
                />
              </div>
              
              <div>
                <Label htmlFor="batch-size">Default Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="1"
                  max="100"
                  value={config.defaultBatchSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, defaultBatchSize: parseInt(e.target.value) || 10 }))}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Deploy the provided Google Cloud Function code to your project</li>
                <li>Copy the function URL from the Google Cloud Console (as shown in your screenshot)</li>
                <li>Paste the URL above and test the connection</li>
                <li>Configure your Supabase URL and service key as environment variables in the function</li>
              </ol>
            </div>
          </>
        )}

        <Button onClick={handleSave} className="w-full">
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
};

export default GlobalGoogleCloudConfig;
