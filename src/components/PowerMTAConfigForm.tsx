import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from '@/hooks/use-toast';
import { testPowerMTAConnection } from '@/utils/powerMTASender';
import { Loader2, TestTube, Globe, Terminal, Plus, Trash2, Shield } from 'lucide-react';

interface PowerMTAConfigFormProps {
  onSubmit: (name: string, config: any) => Promise<void>;
  onCancel: () => void;
  initialData?: any;
}

const PowerMTAConfigForm: React.FC<PowerMTAConfigFormProps> = ({
  onSubmit,
  onCancel,
  initialData
}) => {
  const [formData, setFormData] = useState({
    name: '',
    server_host: '',
    ssh_port: 22,
    username: '',
    password: '',
    api_port: 8080,
    virtual_mta: '',
    job_pool: '',
    proxy_enabled: false,
    proxy_host: '',
    proxy_port: 8080,
    proxy_username: '',
    proxy_password: '',
    manual_overrides: {} as Record<string, string>,
    is_active: true
  });

  const [testing, setTesting] = useState(false);
  const [webTestUrl, setWebTestUrl] = useState('');
  const [newOverrideKey, setNewOverrideKey] = useState('');
  const [newOverrideValue, setNewOverrideValue] = useState('');
  const [pushingConfig, setPushingConfig] = useState(false);

  useEffect(() => {
    if (initialData) {
      console.log('Loading PowerMTA initial data:', initialData);
      setFormData({
        name: initialData.name || '',
        server_host: initialData.config?.server_host || initialData.server_host || '',
        ssh_port: initialData.config?.ssh_port || initialData.ssh_port || 22,
        username: initialData.config?.username || initialData.username || '',
        password: initialData.config?.password || initialData.password || '',
        api_port: initialData.config?.api_port || initialData.api_port || 8080,
        virtual_mta: initialData.config?.virtual_mta || initialData.virtual_mta || '',
        job_pool: initialData.config?.job_pool || initialData.job_pool || '',
        proxy_enabled: initialData.config?.proxy_enabled || initialData.proxy_enabled || false,
        proxy_host: initialData.config?.proxy_host || initialData.proxy_host || '',
        proxy_port: initialData.config?.proxy_port || initialData.proxy_port || 8080,
        proxy_username: initialData.config?.proxy_username || initialData.proxy_username || '',
        proxy_password: initialData.config?.proxy_password || initialData.proxy_password || '',
        manual_overrides: initialData.config?.manual_overrides || initialData.manual_overrides || {},
        is_active: initialData.config?.is_active !== undefined ? initialData.config.is_active : (initialData.is_active !== undefined ? initialData.is_active : true)
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (formData.server_host && formData.api_port) {
      setWebTestUrl(`http://${formData.server_host}:${formData.api_port}`);
    }
  }, [formData.server_host, formData.api_port]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "PowerMTA server name is required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.server_host.trim()) {
      toast({
        title: "Error", 
        description: "Server host/IP is required",
        variant: "destructive"
      });
      return;
    }

    const config = {
      server_host: formData.server_host,
      ssh_port: formData.ssh_port,
      username: formData.username,
      password: formData.password,
      api_port: formData.api_port,
      virtual_mta: formData.virtual_mta,
      job_pool: formData.job_pool,
      proxy_enabled: formData.proxy_enabled,
      proxy_host: formData.proxy_host,
      proxy_port: formData.proxy_port,
      proxy_username: formData.proxy_username,
      proxy_password: formData.proxy_password,
      manual_overrides: formData.manual_overrides,
      is_active: formData.is_active
    };

    await onSubmit(formData.name, config);
  };

  const handleTestConnection = async () => {
    if (!formData.server_host || !formData.username || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in server host, username and password before testing",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    console.log('🔍 Testing PowerMTA connection with:', {
      host: formData.server_host,
      port: formData.ssh_port,
      username: formData.username,
      proxy: formData.proxy_enabled ? `${formData.proxy_host}:${formData.proxy_port}` : 'disabled'
    });

    try {
      const result = await testPowerMTAConnection({
        name: formData.name,
        server_host: formData.server_host,
        ssh_port: formData.ssh_port,
        username: formData.username,
        password: formData.password,
        api_port: formData.api_port,
        proxy_enabled: formData.proxy_enabled,
        proxy_host: formData.proxy_host,
        proxy_port: formData.proxy_port,
        proxy_username: formData.proxy_username,
        proxy_password: formData.proxy_password
      });

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.serverInfo || "PowerMTA server connection successful"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to PowerMTA server",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ PowerMTA test error:', error);
      toast({
        title: "Test Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const addManualOverride = () => {
    if (!newOverrideKey.trim() || !newOverrideValue.trim()) {
      toast({
        title: "Error",
        description: "Both key and value are required for manual override",
        variant: "destructive"
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      manual_overrides: {
        ...prev.manual_overrides,
        [newOverrideKey.trim()]: newOverrideValue.trim()
      }
    }));

    setNewOverrideKey('');
    setNewOverrideValue('');

    toast({
      title: "Override Added",
      description: `Manual override "${newOverrideKey}" has been added`
    });
  };

  const removeManualOverride = (key: string) => {
    setFormData(prev => {
      const newOverrides = { ...prev.manual_overrides };
      delete newOverrides[key];
      return {
        ...prev,
        manual_overrides: newOverrides
      };
    });

    toast({
      title: "Override Removed",
      description: `Manual override "${key}" has been removed`
    });
  };

  const updateManualOverride = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      manual_overrides: {
        ...prev.manual_overrides,
        [key]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {initialData ? 'Edit PowerMTA Server' : 'Add PowerMTA Server'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Server Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., PowerMTA Production"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Server Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Inactive</span>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <span className="text-sm text-gray-500">Active</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="server_host">Server Host/IP *</Label>
                <Input
                  id="server_host"
                  value={formData.server_host}
                  onChange={(e) => setFormData(prev => ({ ...prev, server_host: e.target.value }))}
                  placeholder="212.115.108.142"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ssh_port">SSH Port</Label>
                <Input
                  id="ssh_port"
                  type="number"
                  value={formData.ssh_port}
                  onChange={(e) => setFormData(prev => ({ ...prev, ssh_port: parseInt(e.target.value) || 22 }))}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">SSH Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="root"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">SSH Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="api_port">Web Interface Port</Label>
                <Input
                  id="api_port"
                  type="number"
                  value={formData.api_port}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_port: parseInt(e.target.value) || 8080 }))}
                  placeholder="8080"
                  min="1"
                  max="65535"
                />
              </div>

              <div>
                <Label htmlFor="virtual_mta">Virtual MTA</Label>
                <Input
                  id="virtual_mta"
                  value={formData.virtual_mta}
                  onChange={(e) => setFormData(prev => ({ ...prev, virtual_mta: e.target.value }))}
                  placeholder="default"
                />
              </div>

              <div>
                <Label htmlFor="job_pool">Job Pool</Label>
                <Input
                  id="job_pool"
                  value={formData.job_pool}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_pool: e.target.value }))}
                  placeholder="default"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Proxy Configuration
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Disabled</span>
                  <Switch
                    checked={formData.proxy_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, proxy_enabled: checked }))}
                  />
                  <span className="text-sm text-gray-500">Enabled</span>
                </div>
              </div>

              {formData.proxy_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                  <div>
                    <Label htmlFor="proxy_host">Proxy Host/IP *</Label>
                    <Input
                      id="proxy_host"
                      value={formData.proxy_host}
                      onChange={(e) => setFormData(prev => ({ ...prev, proxy_host: e.target.value }))}
                      placeholder="proxy.example.com"
                      required={formData.proxy_enabled}
                    />
                  </div>

                  <div>
                    <Label htmlFor="proxy_port">Proxy Port *</Label>
                    <Input
                      id="proxy_port"
                      type="number"
                      value={formData.proxy_port}
                      onChange={(e) => setFormData(prev => ({ ...prev, proxy_port: parseInt(e.target.value) || 8080 }))}
                      placeholder="8080"
                      min="1"
                      max="65535"
                      required={formData.proxy_enabled}
                    />
                  </div>

                  <div>
                    <Label htmlFor="proxy_username">Proxy Username</Label>
                    <Input
                      id="proxy_username"
                      value={formData.proxy_username}
                      onChange={(e) => setFormData(prev => ({ ...prev, proxy_username: e.target.value }))}
                      placeholder="proxy_user (optional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="proxy_password">Proxy Password</Label>
                    <Input
                      id="proxy_password"
                      type="password"
                      value={formData.proxy_password}
                      onChange={(e) => setFormData(prev => ({ ...prev, proxy_password: e.target.value }))}
                      placeholder="••••••••••• (optional)"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4" />
                )}
                {testing ? 'Testing SSH...' : 'Test SSH Connection'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (webTestUrl) {
                    window.open(webTestUrl, '_blank', 'width=800,height=600');
                  }
                }}
                disabled={!webTestUrl}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Test Web Interface
              </Button>
            </div>

            {webTestUrl && (
              <div className="space-y-2">
                <Label>Web Interface Preview:</Label>
                <div className="border rounded-lg p-2 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-2">Testing: {webTestUrl}</p>
                  <iframe
                    src={webTestUrl}
                    width="100%"
                    height="300"
                    className="border rounded bg-white"
                    title="PowerMTA Web Interface"
                    onError={() => console.log('Failed to load PowerMTA web interface')}
                  />
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Manual Override Configuration</Label>
                <Badge variant="outline">Customizable</Badge>
              </div>
              
              <p className="text-sm text-gray-600">
                Add custom configuration parameters that will override default PowerMTA settings.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Configuration Key"
                  value={newOverrideKey}
                  onChange={(e) => setNewOverrideKey(e.target.value)}
                />
                <Input
                  placeholder="Configuration Value"
                  value={newOverrideValue}
                  onChange={(e) => setNewOverrideValue(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addManualOverride}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Override
                </Button>
              </div>

              {Object.keys(formData.manual_overrides).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Overrides:</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {Object.entries(formData.manual_overrides).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={key}
                            readOnly
                            className="text-sm font-mono bg-gray-50"
                          />
                          <Input
                            value={value}
                            onChange={(e) => updateManualOverride(key, e.target.value)}
                            className="text-sm font-mono"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeManualOverride(key)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {initialData ? 'Update PowerMTA Server' : 'Add PowerMTA Server'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PowerMTAConfigForm;
