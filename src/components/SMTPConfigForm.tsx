
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, TestTube, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { testSMTPConnection, validateSMTPConfig } from '@/utils/emailSender';
import { toast } from '@/hooks/use-toast';
import SMTPLogViewer from './SMTPLogViewer';

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
}

interface SMTPConfigFormProps {
  config: SMTPConfig;
  onChange: (config: SMTPConfig) => void;
  onTest: () => void;
}

const SMTPConfigForm = ({ config, onChange, onTest }: SMTPConfigFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; logs?: string[] } | null>(null);
  const [showLogDialog, setShowLogDialog] = useState(false);

  const updateConfig = (field: keyof SMTPConfig, value: any) => {
    setTestResult(null);
    onChange({
      ...config,
      [field]: value
    });
  };

  const handleTestConnection = async () => {
    const validation = validateSMTPConfig(config);
    if (!validation.valid) {
      toast({
        title: "Configuration Error",
        description: validation.errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      console.log('Testing SMTP connection with config:', {
        host: config.host,
        port: config.port,
        username: config.username,
        encryption: config.encryption,
        auth_required: config.auth_required
      });

      const result = await testSMTPConnection(config);
      setTestResult(result);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "SMTP connection test passed successfully!",
        });
        onTest();
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "SMTP connection test failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({ success: false, error: errorMessage, logs: [`Fatal error: ${errorMessage}`] });
      toast({
        title: "Test Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>SMTP Server Configuration</CardTitle>
          <CardDescription>
            Configure your SMTP server settings for email sending
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.office365.com"
                value={config.host}
                onChange={(e) => updateConfig('host', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                placeholder="587"
                value={config.port}
                onChange={(e) => updateConfig('port', parseInt(e.target.value) || 587)}
              />
              <p className="text-xs text-slate-500">
                587 for STARTTLS, 465 for SSL/TLS, 25 for plain
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-username">Username/Email</Label>
            <Input
              id="smtp-username"
              type="email"
              placeholder="your-email@domain.com"
              value={config.username}
              onChange={(e) => updateConfig('username', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-password">Password/App Password</Label>
            <div className="relative">
              <Input
                id="smtp-password"
                type={showPassword ? "text" : "password"}
                placeholder="Your password or app-specific password"
                value={config.password}
                onChange={(e) => updateConfig('password', e.target.value)}
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
            <p className="text-xs text-slate-500">
              For Office 365/Outlook, use an app-specific password instead of your regular password
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="encryption">Encryption</Label>
            <Select value={config.encryption} onValueChange={(value: any) => updateConfig('encryption', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Plain)</SelectItem>
                <SelectItem value="tls">TLS/STARTTLS (Recommended)</SelectItem>
                <SelectItem value="ssl">SSL (Port 465)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auth-required"
              checked={config.auth_required}
              onCheckedChange={(checked) => updateConfig('auth_required', checked)}
            />
            <Label htmlFor="auth-required">Authentication Required</Label>
          </div>

          <Separator />

          {/* Test Result Display */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-center justify-between ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {testResult.success ? 'Connection test successful!' : testResult.error}
                </span>
              </div>
              {testResult.logs && testResult.logs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLogDialog(true)}
                  className="ml-2"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  View Logs
                </Button>
              )}
            </div>
          )}

          <Button 
            onClick={handleTestConnection} 
            variant="outline" 
            className="w-full"
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Test SMTP Connection
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Log Viewer Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>SMTP Connection Logs</DialogTitle>
          </DialogHeader>
          {testResult && (
            <SMTPLogViewer
              logs={testResult.logs || []}
              success={testResult.success}
              error={testResult.error}
              onClose={() => setShowLogDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SMTPConfigForm;
