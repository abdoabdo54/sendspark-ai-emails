
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Server, Shield, Settings } from 'lucide-react';

interface PowerMTAConfigFormProps {
  onSubmit: (name: string, config: any) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    name: string;
    config: any;
  };
}

const PowerMTAConfigForm: React.FC<PowerMTAConfigFormProps> = ({
  onSubmit,
  onCancel,
  initialData
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [serverHost, setServerHost] = useState(initialData?.config?.server_host || '');
  const [sshPort, setSshPort] = useState(initialData?.config?.ssh_port || 22);
  const [username, setUsername] = useState(initialData?.config?.username || '');
  const [password, setPassword] = useState(initialData?.config?.password || '');
  const [apiPort, setApiPort] = useState(initialData?.config?.api_port || 8080);
  const [virtualMta, setVirtualMta] = useState(initialData?.config?.virtual_mta || 'default');
  const [jobPool, setJobPool] = useState(initialData?.config?.job_pool || 'default');
  
  // Proxy settings
  const [proxyEnabled, setProxyEnabled] = useState(initialData?.config?.proxy_enabled || false);
  const [proxyHost, setProxyHost] = useState(initialData?.config?.proxy_host || '');
  const [proxyPort, setProxyPort] = useState(initialData?.config?.proxy_port || 3128);
  const [proxyUsername, setProxyUsername] = useState(initialData?.config?.proxy_username || '');
  const [proxyPassword, setProxyPassword] = useState(initialData?.config?.proxy_password || '');
  
  // Manual overrides
  const [manualOverrides, setManualOverrides] = useState(
    JSON.stringify(initialData?.config?.manual_overrides || {}, null, 2)
  );
  
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !serverHost.trim() || !username.trim() || !password.trim()) {
      return;
    }

    setSubmitting(true);
    
    try {
      let parsedOverrides = {};
      if (manualOverrides.trim()) {
        try {
          parsedOverrides = JSON.parse(manualOverrides);
        } catch (error) {
          throw new Error('Invalid JSON in manual overrides');
        }
      }

      const config = {
        server_host: serverHost,
        ssh_port: parseInt(sshPort.toString()) || 22,
        username,
        password,
        api_port: parseInt(apiPort.toString()) || 8080,
        virtual_mta: virtualMta,
        job_pool: jobPool,
        proxy_enabled: proxyEnabled,
        proxy_host: proxyEnabled ? proxyHost : null,
        proxy_port: proxyEnabled ? parseInt(proxyPort.toString()) || 3128 : null,
        proxy_username: proxyEnabled ? proxyUsername : null,
        proxy_password: proxyEnabled ? proxyPassword : null,
        manual_overrides: parsedOverrides,
        is_active: true
      };

      await onSubmit(name, config);
    } catch (error) {
      console.error('Error submitting PowerMTA config:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          {initialData ? 'Edit PowerMTA Server' : 'Add PowerMTA Server'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Alert>
            <Server className="w-4 h-4" />
            <AlertDescription>
              PowerMTA servers provide advanced email distribution with monitoring, pause/resume capabilities, and detailed analytics.
            </AlertDescription>
          </Alert>

          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Basic Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Server Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My PowerMTA Server"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="serverHost">Server Host/IP</Label>
                <Input
                  id="serverHost"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  placeholder="192.168.1.100 or server.example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sshPort">SSH Port</Label>
                <Input
                  id="sshPort"
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(parseInt(e.target.value) || 22)}
                  placeholder="22"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="apiPort">API Port</Label>
                <Input
                  id="apiPort"
                  type="number"
                  value={apiPort}
                  onChange={(e) => setApiPort(parseInt(e.target.value) || 8080)}
                  placeholder="8080"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="root"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="virtualMta">Virtual MTA</Label>
                <Input
                  id="virtualMta"
                  value={virtualMta}
                  onChange={(e) => setVirtualMta(e.target.value)}
                  placeholder="default"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="jobPool">Job Pool</Label>
                <Input
                  id="jobPool"
                  value={jobPool}
                  onChange={(e) => setJobPool(e.target.value)}
                  placeholder="default"
                />
              </div>
            </div>
          </div>

          {/* Proxy Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="proxyEnabled"
                checked={proxyEnabled}
                onCheckedChange={setProxyEnabled}
              />
              <Label htmlFor="proxyEnabled" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Enable Proxy Configuration
              </Label>
            </div>
            
            {proxyEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2">
                  <Label htmlFor="proxyHost">Proxy Host</Label>
                  <Input
                    id="proxyHost"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                    placeholder="proxy.example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="proxyPort">Proxy Port</Label>
                  <Input
                    id="proxyPort"
                    type="number"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(parseInt(e.target.value) || 3128)}
                    placeholder="3128"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="proxyUsername">Proxy Username (Optional)</Label>
                  <Input
                    id="proxyUsername"
                    value={proxyUsername}
                    onChange={(e) => setProxyUsername(e.target.value)}
                    placeholder="proxy_user"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="proxyPassword">Proxy Password (Optional)</Label>
                  <Input
                    id="proxyPassword"
                    type="password"
                    value={proxyPassword}
                    onChange={(e) => setProxyPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Manual Overrides */}
          <div className="space-y-4">
            <h3 className="font-semibold">Manual Configuration Overrides (JSON)</h3>
            <Textarea
              value={manualOverrides}
              onChange={(e) => setManualOverrides(e.target.value)}
              placeholder='{"max-msg-rate": "1000/h", "custom-setting": "value"}'
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-600">
              Optional: Add custom PowerMTA configuration overrides in JSON format
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !serverHost.trim() || !username.trim() || !password.trim()}
              className="flex-1"
            >
              {submitting ? 'Saving...' : (initialData ? 'Update Server' : 'Add Server')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PowerMTAConfigForm;
