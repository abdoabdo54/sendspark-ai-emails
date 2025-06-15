
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, TestTube, Save, AlertTriangle } from 'lucide-react';
import { testPowerMTAConnection, validatePowerMTAConfig } from '@/utils/powerMTASender';

interface PowerMTAConfig {
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
  is_active: boolean;
}

interface PowerMTAConfigFormProps {
  onSave: (config: Omit<PowerMTAConfig, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => void;
  initialConfig?: PowerMTAConfig;
  isEditing?: boolean;
}

const PowerMTAConfigForm: React.FC<PowerMTAConfigFormProps> = ({
  onSave,
  initialConfig,
  isEditing = false
}) => {
  const [config, setConfig] = useState<PowerMTAConfig>({
    name: '',
    server_host: '',
    ssh_port: 22,
    username: '',
    password: '',
    api_port: 8080,
    virtual_mta: 'default',
    job_pool: 'default',
    is_active: true
  });
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  const handleInputChange = (field: keyof PowerMTAConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null); // Clear test result when config changes
  };

  const handleTest = async () => {
    const validation = validatePowerMTAConfig(config);
    if (!validation.valid) {
      toast.error(`Configuration invalid: ${validation.errors.join(', ')}`);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testPowerMTAConnection(config);
      
      if (result.success) {
        setTestResult({
          success: true,
          message: result.serverInfo || 'Connection successful'
        });
        toast.success('PowerMTA connection test successful!');
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed'
        });
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        message: errorMessage
      });
      toast.error(`Test failed: ${errorMessage}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const validation = validatePowerMTAConfig(config);
    if (!validation.valid) {
      toast.error(`Configuration invalid: ${validation.errors.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      await onSave(config);
      if (!isEditing) {
        // Reset form after adding new server
        setConfig({
          name: '',
          server_host: '',
          ssh_port: 22,
          username: '',
          password: '',
          api_port: 8080,
          virtual_mta: 'default',
          job_pool: 'default',
          is_active: true
        });
        setTestResult(null);
      }
    } catch (error) {
      // Error handled in parent component
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditing ? 'Edit PowerMTA Server' : 'Add PowerMTA Server'}
          <Badge variant="outline">Bridge Configuration</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            PowerMTA servers require SSH access and PowerMTA software installed. 
            These servers will act as a bridge to distribute campaigns using your configured sender accounts.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Server Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="My PowerMTA Server"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="server_host">Server Host/IP *</Label>
            <Input
              id="server_host"
              value={config.server_host}
              onChange={(e) => handleInputChange('server_host', e.target.value)}
              placeholder="192.168.1.100 or server.domain.com"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="ssh_port">SSH Port *</Label>
            <Input
              id="ssh_port"
              type="number"
              value={config.ssh_port}
              onChange={(e) => handleInputChange('ssh_port', parseInt(e.target.value) || 22)}
              placeholder="22"
              min="1"
              max="65535"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="api_port">API Port</Label>
            <Input
              id="api_port"
              type="number"
              value={config.api_port || ''}
              onChange={(e) => handleInputChange('api_port', parseInt(e.target.value) || undefined)}
              placeholder="8080"
              min="1"
              max="65535"
            />
          </div>
          
          <div className="flex items-center space-x-2 mt-6">
            <input
              type="checkbox"
              id="is_active"
              checked={config.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">SSH Username *</Label>
            <Input
              id="username"
              value={config.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="root"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">SSH Password *</Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="virtual_mta">Virtual MTA</Label>
            <Input
              id="virtual_mta"
              value={config.virtual_mta || ''}
              onChange={(e) => handleInputChange('virtual_mta', e.target.value)}
              placeholder="default"
            />
          </div>
          
          <div>
            <Label htmlFor="job_pool">Job Pool</Label>
            <Input
              id="job_pool"
              value={config.job_pool || ''}
              onChange={(e) => handleInputChange('job_pool', e.target.value)}
              placeholder="default"
            />
          </div>
        </div>

        {testResult && (
          <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <AlertDescription>
              <strong>Test Result:</strong> {testResult.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !config.name || !config.server_host || !config.username || !config.password}
          >
            {testing ? (
              <>
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={saving || !config.name || !config.server_host || !config.username || !config.password}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Update Server' : 'Add Server'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PowerMTAConfigForm;
