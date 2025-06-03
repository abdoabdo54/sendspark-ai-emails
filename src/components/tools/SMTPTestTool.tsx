
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TestTube, Loader2, CheckCircle, XCircle, Eye, EyeOff, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SMTPLogViewer from '@/components/SMTPLogViewer';

interface SMTPTestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
  test_email: string;
  test_subject: string;
  test_message: string;
}

const SMTPTestTool = () => {
  const [config, setConfig] = useState<SMTPTestConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls',
    auth_required: true,
    test_email: '',
    test_subject: 'SMTP Test Email',
    test_message: 'This is a test email to verify SMTP configuration.'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; logs?: string[] } | null>(null);
  const [showLogDialog, setShowLogDialog] = useState(false);

  const updateConfig = (field: keyof SMTPTestConfig, value: any) => {
    setTestResult(null);
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const testSMTPConnection = async () => {
    if (!config.host || !config.port || !config.username || !config.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all SMTP configuration fields",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/smtp-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6YXR4dHRhenh3cWF3ZWZ1bWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzE1NTAsImV4cCI6MjA2Mzg0NzU1MH0.2hJNt57jErh8GgjbXc8vNg94F0FFBZS7tXxmdQvRG_w`
        },
        body: JSON.stringify({
          config: {
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            encryption: config.encryption,
            auth_required: config.auth_required
          }
        })
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "SMTP connection test passed successfully!",
        });
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
      setIsTesting(false);
    }
  };

  const sendTestEmail = async () => {
    if (!config.test_email) {
      toast({
        title: "Missing Email",
        description: "Please enter a test email address",
        variant: "destructive"
      });
      return;
    }

    if (!testResult?.success) {
      toast({
        title: "Connection Required",
        description: "Please test the SMTP connection first",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/send-smtp-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6YXR4dHRhenh3cWF3ZWZ1bWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzE1NTAsImV4cCI6MjA2Mzg0NzU1MH0.2hJNt57jErh8GgjbXc8vNg94F0FFBZS7tXxmdQvRG_w`
        },
        body: JSON.stringify({
          config: {
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            encryption: config.encryption,
            auth_required: config.auth_required
          },
          emailData: {
            from: { email: config.username, name: 'SMTP Test' },
            to: config.test_email,
            subject: config.test_subject,
            text: config.test_message,
            html: `<p>${config.test_message}</p>`
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Email Sent",
          description: `Test email sent successfully to ${config.test_email}`,
        });
      } else {
        toast({
          title: "Send Failed",
          description: result.error || "Failed to send test email",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Send Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">SMTP Connection Tester</h3>
          <p className="text-slate-600">
            Test your SMTP server configuration without saving credentials
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SMTP Configuration</CardTitle>
            <CardDescription>
              Enter your SMTP server details for testing
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
              <Label htmlFor="smtp-password">Password</Label>
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
              onClick={testSMTPConnection} 
              variant="outline" 
              className="w-full"
              disabled={isTesting}
            >
              {isTesting ? (
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

        {testResult?.success && (
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>
                Send a test email to verify the SMTP configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="test@example.com"
                  value={config.test_email}
                  onChange={(e) => updateConfig('test_email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-subject">Subject</Label>
                <Input
                  id="test-subject"
                  placeholder="SMTP Test Email"
                  value={config.test_subject}
                  onChange={(e) => updateConfig('test_subject', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-message">Message</Label>
                <Textarea
                  id="test-message"
                  placeholder="This is a test email to verify SMTP configuration."
                  value={config.test_message}
                  onChange={(e) => updateConfig('test_message', e.target.value)}
                  rows={3}
                />
              </div>

              <Button 
                onClick={sendTestEmail} 
                className="w-full"
                disabled={isTesting || !config.test_email}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

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

export default SMTPTestTool;
