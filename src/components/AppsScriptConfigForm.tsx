
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Code, Eye, EyeOff } from 'lucide-react';

interface AppsScriptConfig {
  exec_url: string;
  api_key?: string;
  script_id?: string;
  deployment_id?: string;
}

interface AppsScriptConfigFormProps {
  onSubmit: (name: string, email: string, config: AppsScriptConfig) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    email: string;
    config: AppsScriptConfig;
  };
}

const AppsScriptConfigForm = ({ onSubmit, onCancel, initialData }: AppsScriptConfigFormProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<AppsScriptConfig>(initialData?.config || {
    exec_url: '',
    api_key: '',
    script_id: '',
    deployment_id: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name, email, config);
  };

  const updateConfig = (key: keyof AppsScriptConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Google Apps Script Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertDescription>
            Configure your Google Apps Script settings. Rate limits are now controlled at the campaign level for optimal performance and speed.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account-name">Account Name *</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Apps Script Account"
                required
              />
            </div>
            <div>
              <Label htmlFor="from-email">From Email *</Label>
              <Input
                id="from-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sender@yourdomain.com"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="exec-url">Execution URL *</Label>
            <Textarea
              id="exec-url"
              value={config.exec_url}
              onChange={(e) => updateConfig('exec_url', e.target.value)}
              placeholder="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
              rows={3}
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              The web app URL from your Google Apps Script deployment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="script-id">Script ID</Label>
              <Input
                id="script-id"
                value={config.script_id || ''}
                onChange={(e) => updateConfig('script_id', e.target.value)}
                placeholder="1BxKp4Q..."
              />
            </div>
            <div>
              <Label htmlFor="deployment-id">Deployment ID</Label>
              <Input
                id="deployment-id"
                value={config.deployment_id || ''}
                onChange={(e) => updateConfig('deployment_id', e.target.value)}
                placeholder="AKfyc..."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="api-key">API Key (Optional)</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={config.api_key || ''}
                onChange={(e) => updateConfig('api_key', e.target.value)}
                placeholder="Your Google Cloud API key (if required)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update Account' : 'Add Account'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AppsScriptConfigForm;
