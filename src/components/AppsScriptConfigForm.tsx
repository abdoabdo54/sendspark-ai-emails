
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface AppsScriptConfig {
  script_id: string;
  deployment_id: string;
  api_key: string;
  daily_quota: number;
}

interface AppsScriptConfigFormProps {
  config: AppsScriptConfig;
  onChange: (config: AppsScriptConfig) => void;
}

const AppsScriptConfigForm = ({ config, onChange }: AppsScriptConfigFormProps) => {
  const updateConfig = (field: keyof AppsScriptConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Apps Script Configuration</CardTitle>
        <CardDescription>
          Configure your Google Apps Script deployment for high-volume email sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="script-id">Script ID</Label>
          <Input
            id="script-id"
            placeholder="AKfycby..."
            value={config.script_id}
            onChange={(e) => updateConfig('script_id', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deployment-id">Deployment ID</Label>
          <Input
            id="deployment-id"
            placeholder="AKfycbx..."
            value={config.deployment_id}
            onChange={(e) => updateConfig('deployment_id', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <Input
            id="api-key"
            type="password"
            placeholder="Your Google API key"
            value={config.api_key}
            onChange={(e) => updateConfig('api_key', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="daily-quota">Daily Email Quota</Label>
          <Input
            id="daily-quota"
            type="number"
            placeholder="100"
            value={config.daily_quota}
            onChange={(e) => updateConfig('daily_quota', parseInt(e.target.value) || 100)}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Create a new Google Apps Script project</li>
            <li>Deploy as web app with execute permissions for "Anyone"</li>
            <li>Copy the deployment ID and script ID</li>
            <li>Enable Gmail API in Google Cloud Console</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Badge variant="secondary">Free Tier: 100 emails/day</Badge>
          <Badge variant="secondary">Paid: Up to 1,500 emails/day</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppsScriptConfigForm;
