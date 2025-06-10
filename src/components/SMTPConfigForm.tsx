
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield } from 'lucide-react';

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  security: 'none' | 'tls' | 'ssl';
  use_auth: boolean;
}

interface SMTPConfigFormProps {
  onSubmit: (name: string, email: string, config: SMTPConfig) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    email: string;
    config: SMTPConfig;
  };
}

const SMTPConfigForm = ({ onSubmit, onCancel, initialData }: SMTPConfigFormProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [showPassword, setShowPassword] = useState(false);
  const [config, setConfig] = useState<SMTPConfig>(initialData?.config || {
    host: '',
    port: 587,
    username: '',
    password: '',
    security: 'tls',
    use_auth: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name, email, config);
  };

  const updateConfig = (key: keyof SMTPConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          SMTP Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertDescription>
            Configure your SMTP server settings. Rate limits are now controlled at the campaign level for optimal performance and speed.
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
                placeholder="My SMTP Account"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtp-host">SMTP Host *</Label>
              <Input
                id="smtp-host"
                value={config.host}
                onChange={(e) => updateConfig('host', e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="smtp-port">Port *</Label>
              <Input
                id="smtp-port"
                type="number"
                value={config.port}
                onChange={(e) => updateConfig('port', parseInt(e.target.value))}
                placeholder="587"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="security">Security</Label>
            <Select value={config.security} onValueChange={(value: 'none' | 'tls' | 'ssl') => updateConfig('security', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="use-auth"
              checked={config.use_auth}
              onCheckedChange={(checked) => updateConfig('use_auth', checked)}
            />
            <Label htmlFor="use-auth">Use Authentication</Label>
          </div>

          {config.use_auth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp-username">Username *</Label>
                <Input
                  id="smtp-username"
                  value={config.username}
                  onChange={(e) => updateConfig('username', e.target.value)}
                  placeholder="your-email@gmail.com"
                  required={config.use_auth}
                />
              </div>
              <div>
                <Label htmlFor="smtp-password">Password *</Label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showPassword ? 'text' : 'password'}
                    value={config.password}
                    onChange={(e) => updateConfig('password', e.target.value)}
                    placeholder="your-app-password"
                    required={config.use_auth}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

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

export default SMTPConfigForm;
