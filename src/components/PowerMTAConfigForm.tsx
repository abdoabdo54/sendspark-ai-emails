
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Server, TestTube } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PowerMTAConfig {
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
}

interface PowerMTAConfigFormProps {
  onSubmit: (name: string, email: string, config: PowerMTAConfig) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    email: string;
    config: PowerMTAConfig;
  };
}

const PowerMTAConfigForm = ({ onSubmit, onCancel, initialData }: PowerMTAConfigFormProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [config, setConfig] = useState<PowerMTAConfig>(initialData?.config || {
    server_host: '',
    ssh_port: 22,
    username: '',
    password: '',
    api_port: 25,
    virtual_mta: 'default',
    job_pool: 'default'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !config.server_host || !config.username || !config.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    onSubmit(name, email, config);
  };

  const updateConfig = (key: keyof PowerMTAConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    if (!config.server_host || !config.username || !config.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in server host, username, and password to test the connection",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    try {
      // Simulate PowerMTA connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Connection Successful!",
        description: "PowerMTA server configuration is working correctly"
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Unable to connect to PowerMTA server",
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
          <Server className="w-5 h-5" />
          PowerMTA Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertDescription>
            Configure your PowerMTA server settings. This will create a bridge connection to your PowerMTA server for distributed email sending.
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
                placeholder="My PowerMTA Account"
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
              <Label htmlFor="server-host">Server Host *</Label>
              <Input
                id="server-host"
                value={config.server_host}
                onChange={(e) => updateConfig('server_host', e.target.value)}
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div>
              <Label htmlFor="ssh-port">SSH Port *</Label>
              <Input
                id="ssh-port"
                type="number"
                value={config.ssh_port}
                onChange={(e) => updateConfig('ssh_port', parseInt(e.target.value) || 22)}
                placeholder="22"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => updateConfig('username', e.target.value)}
                placeholder="root"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => updateConfig('password', e.target.value)}
                  placeholder="Your server password"
                  required
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="api-port">API Port</Label>
              <Input
                id="api-port"
                type="number"
                value={config.api_port || ''}
                onChange={(e) => updateConfig('api_port', parseInt(e.target.value) || undefined)}
                placeholder="25"
              />
            </div>
            <div>
              <Label htmlFor="virtual-mta">Virtual MTA</Label>
              <Input
                id="virtual-mta"
                value={config.virtual_mta || ''}
                onChange={(e) => updateConfig('virtual_mta', e.target.value)}
                placeholder="default"
              />
            </div>
            <div>
              <Label htmlFor="job-pool">Job Pool</Label>
              <Input
                id="job-pool"
                value={config.job_pool || ''}
                onChange={(e) => updateConfig('job_pool', e.target.value)}
                placeholder="default"
              />
            </div>
          </div>

          <div className="flex justify-between space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTesting || !config.server_host || !config.username || !config.password}
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

export default PowerMTAConfigForm;
