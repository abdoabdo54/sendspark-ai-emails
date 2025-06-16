
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Server, TestTube, ExternalLink, Globe, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { testPowerMTAConnection } from '@/utils/powerMTASender';

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
  onSubmit: (name: string, config: PowerMTAConfig) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    config: PowerMTAConfig;
  };
}

const PowerMTAConfigForm = ({ onSubmit, onCancel, initialData }: PowerMTAConfigFormProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showWebTest, setShowWebTest] = useState(false);
  const [webTestStatus, setWebTestStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  const [config, setConfig] = useState<PowerMTAConfig>(initialData?.config || {
    server_host: '',
    ssh_port: 22,
    username: '',
    password: '',
    api_port: 8080,
    virtual_mta: 'default',
    job_pool: 'default'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !config.server_host || !config.username || !config.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    onSubmit(name, config);
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
      console.log('🔍 Testing PowerMTA SSH connection:', { 
        host: config.server_host, 
        port: config.ssh_port,
        username: config.username
      });
      
      const result = await testPowerMTAConnection({
        name: name || 'Test Server',
        ...config
      });
      
      if (result.success) {
        toast({
          title: "SSH Connection Successful!",
          description: result.serverInfo || "PowerMTA server SSH connection is working correctly"
        });
      } else {
        toast({
          title: "SSH Connection Failed",
          description: result.error || "Unable to connect to PowerMTA server via SSH",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('SSH connection test error:', error);
      toast({
        title: "SSH Connection Failed",
        description: "Unable to connect to PowerMTA server via SSH",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleWebTest = () => {
    setShowWebTest(!showWebTest);
    if (!showWebTest) {
      setWebTestStatus('loading');
    } else {
      setWebTestStatus(null);
    }
  };

  const getWebInterfaceUrl = () => {
    const port = config.api_port || 8080;
    return `http://${config.server_host}:${port}`;
  };

  const handleIframeLoad = () => {
    console.log('✅ PowerMTA web interface loaded successfully');
    setWebTestStatus('success');
    toast({
      title: "Web Interface Loaded",
      description: "PowerMTA web interface is accessible"
    });
  };

  const handleIframeError = () => {
    console.error('❌ PowerMTA web interface failed to load');
    setWebTestStatus('error');
    toast({
      title: "Web Interface Failed",
      description: "Unable to load PowerMTA web interface - check server host and port",
      variant: "destructive"
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          PowerMTA Server Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertDescription>
            Configure your PowerMTA server settings. PowerMTA will use your existing SMTP and Apps Script accounts for sending - no separate email configuration needed.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="server-name">Server Name *</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My PowerMTA Server"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="server-host">Server Host/IP *</Label>
              <Input
                id="server-host"
                value={config.server_host}
                onChange={(e) => updateConfig('server_host', e.target.value)}
                placeholder="192.168.1.100 or server.domain.com"
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
              <Label htmlFor="username">SSH Username *</Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => updateConfig('username', e.target.value)}
                placeholder="root"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">SSH Password *</Label>
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
              <Label htmlFor="api-port">Web Interface Port</Label>
              <Input
                id="api-port"
                type="number"
                value={config.api_port || ''}
                onChange={(e) => updateConfig('api_port', parseInt(e.target.value) || undefined)}
                placeholder="8080"
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

          {/* Web Interface Test Section */}
          {config.server_host && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  PowerMTA Web Interface Test
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleToggleWebTest}
                  >
                    {showWebTest ? 'Hide' : 'Show'} Web Test
                  </Button>
                </CardTitle>
              </CardHeader>
              {showWebTest && (
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p><strong>URL:</strong> {getWebInterfaceUrl()}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {webTestStatus === 'loading' && (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-blue-700">Loading web interface...</span>
                        </>
                      )}
                      {webTestStatus === 'success' && (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-700">Web interface loaded successfully</span>
                        </>
                      )}
                      {webTestStatus === 'error' && (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-700">Failed to load web interface</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg bg-white" style={{ height: '300px' }}>
                    <iframe
                      src={getWebInterfaceUrl()}
                      className="w-full h-full rounded-lg"
                      title="PowerMTA Web Interface"
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                      sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(getWebInterfaceUrl(), '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open in New Tab
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTesting || !config.server_host || !config.username || !config.password}
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Testing SSH...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  Test SSH Connection
                </>
              )}
            </Button>
          </div>
          
          <div className="flex justify-between space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update Server' : 'Add Server'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PowerMTAConfigForm;
