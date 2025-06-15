
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, TestTube } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { testSMTPConnection, validateSMTPConfig } from '@/utils/emailSender';

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
  const [isTesting, setIsTesting] = useState(false);
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
    
    // Validate configuration
    const validation = validateSMTPConfig({
      ...config,
      encryption: config.security,
      auth_required: config.use_auth
    });

    if (!validation.valid) {
      toast({
        title: "Configuration Error",
        description: validation.errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    onSubmit(name, email, config);
  };

  const updateConfig = (key: keyof SMTPConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    if (!config.host || !config.username || !config.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in host, username, and password to test the connection",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await testSMTPConnection({
        ...config,
        encryption: config.security,
        auth_required: config.use_auth
      });

      if (result.success) {
        toast({
          title: "Connection Successful!",
          description: "SMTP configuration is working correctly"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Unable to connect to SMTP server",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
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
            Configure your SMTP server settings. Make sure to use the correct port and security settings for your email provider.
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
                <SelectItem value="none">None (Plain)</SelectItem>
                <SelectItem value="tls">TLS/STARTTLS (Port 587)</SelectItem>
                <SelectItem value="ssl">SSL (Port 465)</SelectItem>
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

          <div className="flex justify-between space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTesting || !config.host || !config.username || !config.password}
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
            
            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {initialData ? 'Update Account' : 'Add Account'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SMTPConfigForm;
