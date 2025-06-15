
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { testPowerMTAConnection } from '@/utils/powerMTASender';

interface PowerMTAConfig {
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
}

interface PowerMTAConfigFormProps {
  onSave: (config: PowerMTAConfig) => void;
  initialConfig?: PowerMTAConfig;
  isEditing?: boolean;
}

const PowerMTAConfigForm: React.FC<PowerMTAConfigFormProps> = ({ 
  onSave, 
  initialConfig, 
  isEditing = false 
}) => {
  const [config, setConfig] = useState<PowerMTAConfig>(
    initialConfig || {
      name: '',
      server_host: '',
      ssh_port: 22,
      username: 'root',
      password: '',
      api_port: 8080,
      virtual_mta: 'default',
      job_pool: 'default'
    }
  );
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleInputChange = (field: keyof PowerMTAConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testPowerMTAConnection(config);
      setTestResult(result);
      
      if (result.success) {
        toast.success('PowerMTA connection successful!');
      } else {
        toast.error(`PowerMTA connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('PowerMTA test failed');
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!config.name || !config.server_host || !config.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    onSave(config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Edit' : 'Add'} PowerMTA Server Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            PowerMTA server will act as a bridge to distribute campaigns using your SMTP and Apps Script accounts.
            The server must have PowerMTA installed and API access enabled.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              placeholder="e.g., PowerMTA-Server-1"
              value={config.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="server_host">Server IP/Host</Label>
            <Input
              id="server_host"
              placeholder="e.g., 192.168.1.100"
              value={config.server_host}
              onChange={(e) => handleInputChange('server_host', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="ssh_port">SSH Port</Label>
            <Input
              id="ssh_port"
              type="number"
              value={config.ssh_port}
              onChange={(e) => handleInputChange('ssh_port', parseInt(e.target.value))}
            />
          </div>
          
          <div>
            <Label htmlFor="username">SSH Username</Label>
            <Input
              id="username"
              value={config.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">SSH Password</Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="api_port">PowerMTA API Port</Label>
            <Input
              id="api_port"
              type="number"
              value={config.api_port}
              onChange={(e) => handleInputChange('api_port', parseInt(e.target.value))}
            />
          </div>
          
          <div>
            <Label htmlFor="virtual_mta">Virtual MTA</Label>
            <Input
              id="virtual_mta"
              placeholder="default"
              value={config.virtual_mta}
              onChange={(e) => handleInputChange('virtual_mta', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="job_pool">Job Pool</Label>
            <Input
              id="job_pool"
              placeholder="default"
              value={config.job_pool}
              onChange={(e) => handleInputChange('job_pool', e.target.value)}
            />
          </div>
        </div>

        {testResult && (
          <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription>
              {testResult.success ? (
                <>✅ PowerMTA Connection Successful! Server Info: {testResult.serverInfo}</>
              ) : (
                <>❌ PowerMTA Connection Failed: {testResult.error}</>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing || !config.server_host || !config.password}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!config.name || !config.server_host || !config.password}
          >
            {isEditing ? 'Update' : 'Save'} PowerMTA Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PowerMTAConfigForm;
