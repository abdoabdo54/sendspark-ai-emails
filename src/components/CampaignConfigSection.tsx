import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Cloud, Zap, Settings, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface CampaignConfigSectionProps {
  config: any;
  onConfigChange: (config: any) => void;
}

const CampaignConfigSection: React.FC<CampaignConfigSectionProps> = ({ 
  config, 
  onConfigChange 
}) => {
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    // Load global settings from localStorage
    const savedSettings = localStorage.getItem('emailCampaignSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGlobalSettings(parsed);
      } catch (error) {
        console.error('Error loading global settings:', error);
      }
    }
  }, []);

  const handleGoogleCloudToggle = (enabled: boolean) => {
    if (enabled && (!globalSettings?.googleCloudFunctions?.enabled || !globalSettings?.googleCloudFunctions?.functionUrl)) {
      // Redirect to settings if global GCF is not configured
      return;
    }

    const updatedConfig = {
      ...config,
      googleCloud: {
        enabled,
        rateLimit: config?.googleCloud?.rateLimit || globalSettings?.googleCloudFunctions?.defaultRateLimit || 3600,
        batchSize: config?.googleCloud?.batchSize || globalSettings?.googleCloudFunctions?.defaultBatchSize || 10,
        // Use global settings
        functionUrl: globalSettings?.googleCloudFunctions?.functionUrl,
        projectId: globalSettings?.googleCloudFunctions?.projectId,
        region: globalSettings?.googleCloudFunctions?.region,
        functionName: globalSettings?.googleCloudFunctions?.functionName
      }
    };

    onConfigChange(updatedConfig);
  };

  const handleRateLimitChange = (rateLimit: number) => {
    onConfigChange({
      ...config,
      googleCloud: {
        ...config?.googleCloud,
        rateLimit
      }
    });
  };

  const handleBatchSizeChange = (batchSize: number) => {
    onConfigChange({
      ...config,
      googleCloud: {
        ...config?.googleCloud,
        batchSize
      }
    });
  };

  const isGlobalGCFConfigured = globalSettings?.googleCloudFunctions?.enabled && globalSettings?.googleCloudFunctions?.functionUrl;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            <CardTitle>Campaign Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure advanced settings for your email campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Cloud Functions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Use Google Cloud Functions</Label>
                <p className="text-sm text-slate-600">High-speed sending with advanced rate limiting</p>
              </div>
              <div className="flex items-center gap-2">
                {config?.googleCloud?.enabled && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    Google Cloud
                  </Badge>
                )}
                <Switch
                  checked={config?.googleCloud?.enabled || false}
                  onCheckedChange={handleGoogleCloudToggle}
                  disabled={!isGlobalGCFConfigured}
                />
              </div>
            </div>

            {!isGlobalGCFConfigured && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>Google Cloud Functions is not configured globally. Set it up once in Settings to use across all campaigns.</span>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/#settings'}>
                      Go to Settings
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {config?.googleCloud?.enabled && isGlobalGCFConfigured && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gcfRateLimit">Rate Limit (emails/hour)</Label>
                    <Input
                      id="gcfRateLimit"
                      type="number"
                      min="1"
                      max="3600"
                      value={config?.googleCloud?.rateLimit || globalSettings?.googleCloudFunctions?.defaultRateLimit || 3600}
                      onChange={(e) => handleRateLimitChange(parseInt(e.target.value) || 3600)}
                    />
                    <p className="text-xs text-slate-600">
                      Controls the sending speed across all accounts
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gcfBatchSize">Batch Size</Label>
                    <Input
                      id="gcfBatchSize"
                      type="number"
                      min="1"
                      max="100"
                      value={config?.googleCloud?.batchSize || globalSettings?.googleCloudFunctions?.defaultBatchSize || 10}
                      onChange={(e) => handleBatchSizeChange(parseInt(e.target.value) || 10)}
                    />
                    <p className="text-xs text-slate-600">
                      Number of emails processed concurrently
                    </p>
                  </div>
                </div>

                <div className="text-sm text-blue-800">
                  <p><strong>Function:</strong> {globalSettings?.googleCloudFunctions?.functionUrl}</p>
                  <p><strong>Project:</strong> {globalSettings?.googleCloudFunctions?.projectId}</p>
                  <p><strong>Performance:</strong> Optimized for high-volume sending with rate limiting</p>
                </div>
              </div>
            )}
          </div>

          {/* Other Configuration Options */}
          <div className="flex items-center justify-between">
            <div>
              <Label>High-Volume Sending</Label>
              <p className="text-sm text-slate-600">Use advanced sending methods for large campaigns</p>
            </div>
            <div className="flex items-center gap-2">
              {config?.rotation?.useRotation && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Rotation
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignConfigSection;
