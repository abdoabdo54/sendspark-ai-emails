
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Server, TestTube, ExternalLink } from 'lucide-react';
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
      const result = await testPowerMTAConnection({
        name: name || 'Test Server',
        ...config
      });
      
      if (result.success) {
        toast({
          title: "Connection Successful!",
          description: result.serverInfo || "PowerMTA server configuration is working correctly"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Unable to connect to PowerMTA server",
          variant: "destructive"
        });
      }
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

  const handleOpenPowerMTAInterface = () => {
    if (!config.server_host) {
      toast({
        title: "Missing Server Host",
        description: "Please enter the server host first",
        variant: "destructive"
      });
      return;
    }

    const testUrl = `http://${config.server_host}:${config.api_port || 25}`;
    
    // Open PowerMTA web interface in a new window
    const testWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (testWindow) {
      testWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PowerMTA Interface - ${config.server_host}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #eee;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .test-link {
              display: inline-block;
              background: #007bff;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 0;
              text-align: center;
              width: 100%;
              box-sizing: border-box;
            }
            .test-link:hover {
              background: #0056b3;
            }
            .status {
              padding: 10px;
              border-radius: 5px;
              margin: 10px 0;
              text-align: center;
            }
            .loading { background: #fff3cd; color: #856404; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            .close-btn {
              padding: 8px 16px;
              background: #6c757d;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PowerMTA Web Interface Test</h1>
              <h2>${config.server_host}</h2>
            </div>
            
            <div class="info">
              <strong>Server:</strong> ${config.server_host}<br>
              <strong>Port:</strong> ${config.api_port || 25}<br>
              <strong>Interface URL:</strong> ${testUrl}
            </div>
            
            <div id="status" class="status loading">
              🔍 Preparing to test PowerMTA interface...
            </div>
            
            <a href="${testUrl}" target="_blank" class="test-link">
              🌐 Open PowerMTA Web Interface
            </a>
            
            <div style="margin-top: 20px;">
              <h3>How to verify connection:</h3>
              <ul>
                <li>Click the link above to open PowerMTA web interface</li>
                <li>If you see the PowerMTA login page or dashboard, the server is accessible</li>
                <li>If the page doesn't load, check your server configuration and firewall</li>
                <li>Default PowerMTA web interface runs on port 8080 or 25</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <button onclick="window.close()" class="close-btn">
                Close Window
              </button>
            </div>
          </div>
          
          <script>
            setTimeout(() => {
              const statusDiv = document.getElementById('status');
              statusDiv.className = 'status success';
              statusDiv.innerHTML = '✅ Ready to test - click the link above to verify PowerMTA accessibility';
            }, 1000);
          </script>
        </body>
        </html>
      `);
      testWindow.document.close();
    } else {
      toast({
        title: "Popup Blocked",
        description: "Unable to open test window. Please check your popup blocker.",
        variant: "destructive"
      });
    }
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
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleOpenPowerMTAInterface}
              disabled={!config.server_host}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Test Web Interface
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
