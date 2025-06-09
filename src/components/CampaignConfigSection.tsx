
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Cloud, Zap, Settings } from 'lucide-react';
import GoogleCloudConfigForm from './GoogleCloudConfigForm';

interface CampaignConfigSectionProps {
  config: any;
  onConfigChange: (config: any) => void;
}

const CampaignConfigSection: React.FC<CampaignConfigSectionProps> = ({ 
  config, 
  onConfigChange 
}) => {
  const handleGoogleCloudSave = (googleCloudConfig: any) => {
    onConfigChange({
      ...config,
      googleCloud: googleCloudConfig
    });
  };

  const handleGoogleCloudTest = async (googleCloudConfig: any): Promise<boolean> => {
    try {
      // Test the Google Cloud Function URL
      const response = await fetch(googleCloudConfig.functionUrl, {
        method: 'GET',
      });
      
      return response.ok;
    } catch (error) {
      console.error('Google Cloud test error:', error);
      return false;
    }
  };

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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>High-Volume Sending</Label>
              <p className="text-sm text-slate-600">Use advanced sending methods for large campaigns</p>
            </div>
            <div className="flex items-center gap-2">
              {config?.googleCloud?.enabled && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  Google Cloud
                </Badge>
              )}
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

      <GoogleCloudConfigForm
        config={config?.googleCloud}
        onSave={handleGoogleCloudSave}
        onTest={handleGoogleCloudTest}
      />
    </div>
  );
};

export default CampaignConfigSection;
