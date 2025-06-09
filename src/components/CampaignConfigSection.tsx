
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cloud } from 'lucide-react';

interface CampaignConfigSectionProps {
  config: any;
  onConfigChange: (config: any) => void;
}

const CampaignConfigSection: React.FC<CampaignConfigSectionProps> = ({ 
  config, 
  onConfigChange 
}) => {
  const updateConfig = (field: string, value: any) => {
    const newConfig = { ...config };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newConfig[parent] = { ...newConfig[parent], [child]: value };
    } else {
      newConfig[field] = value;
    }
    onConfigChange(newConfig);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          Campaign Configuration
        </CardTitle>
        <CardDescription>
          Configure sending method and rate limiting for this campaign
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Use Google Cloud Functions</Label>
            <p className="text-sm text-slate-500">
              Enable high-speed sending via Google Cloud Functions
            </p>
          </div>
          <Switch
            checked={config.googleCloud?.enabled || false}
            onCheckedChange={(checked) => updateConfig('googleCloud.enabled', checked)}
          />
        </div>

        {config.googleCloud?.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate Limit (emails/hour)</Label>
              <Input
                id="rateLimit"
                type="number"
                min="1"
                max="3600"
                value={config.googleCloud?.rateLimit || 3600}
                onChange={(e) => updateConfig('googleCloud.rateLimit', parseInt(e.target.value) || 3600)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batchSize">Batch Size</Label>
              <Input
                id="batchSize"
                type="number"
                min="1"
                max="50"
                value={config.googleCloud?.batchSize || 10}
                onChange={(e) => updateConfig('googleCloud.batchSize', parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignConfigSection;
