
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TestTube, Loader2, CheckCircle, XCircle, Mail, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { sendEmailViaAppsScript, testAppsScriptConnection } from '@/utils/appsScriptSender';

interface AppsScriptTestConfig {
  exec_url: string;
  daily_quota: number;
  test_email: string;
  test_subject: string;
  test_message: string;
  from_name: string;
}

const AppsScriptTestTool = () => {
  const [config, setConfig] = useState<AppsScriptTestConfig>({
    exec_url: '',
    daily_quota: 100,
    test_email: '',
    test_subject: 'Apps Script Test Email',
    test_message: 'This is a test email to verify Apps Script configuration.',
    from_name: 'Test Sender'
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; remainingQuota?: number } | null>(null);

  const updateConfig = (field: keyof AppsScriptTestConfig, value: any) => {
    setTestResult(null);
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const testAppsScriptConnectionHandler = async () => {
    if (!config.exec_url) {
      toast({
        title: "Missing Information",
        description: "Please enter the Apps Script execution URL",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testAppsScriptConnection({
        exec_url: config.exec_url,
        daily_quota: config.daily_quota
      });

      setTestResult(result);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Apps Script connection test passed! Remaining quota: ${result.remainingQuota || 'Unknown'}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Apps Script connection test failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({ success: false, error: errorMessage });
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

    if (!config.exec_url) {
      toast({
        title: "Missing Apps Script URL",
        description: "Please configure Apps Script URL first",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);

    try {
      const result = await sendEmailViaAppsScript(
        {
          exec_url: config.exec_url,
          daily_quota: config.daily_quota
        },
        config.test_email, // This will be used as from email in demo mode
        config.from_name,
        config.test_email,
        config.test_subject,
        `<p>${config.test_message}</p>`,
        config.test_message
      );

      if (result.success) {
        toast({
          title: "Email Sent",
          description: `Test email sent successfully to ${config.test_email}. Remaining quota: ${result.remainingQuota || 'Unknown'}`,
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
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Apps Script Connection Tester</h3>
        <p className="text-slate-600">
          Test your Google Apps Script Web App configuration and send test emails
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apps Script Configuration</CardTitle>
          <CardDescription>
            Enter your Google Apps Script Web App details for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exec-url">Apps Script Web App URL</Label>
            <Input
              id="exec-url"
              placeholder="https://script.google.com/macros/s/your-script-id/exec"
              value={config.exec_url}
              onChange={(e) => updateConfig('exec_url', e.target.value)}
            />
            <p className="text-xs text-slate-500">
              The execution URL of your deployed Google Apps Script Web App
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-quota">Daily Email Quota</Label>
            <Input
              id="daily-quota"
              type="number"
              placeholder="100"
              value={config.daily_quota}
              onChange={(e) => updateConfig('daily_quota', parseInt(e.target.value) || 100)}
            />
            <p className="text-xs text-slate-500">
              Maximum emails per day for this Apps Script account
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from-name">From Name</Label>
            <Input
              id="from-name"
              placeholder="Test Sender"
              value={config.from_name}
              onChange={(e) => updateConfig('from_name', e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="test-email">Test Recipient Email</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="recipient@example.com"
              value={config.test_email}
              onChange={(e) => updateConfig('test_email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-subject">Test Email Subject</Label>
            <Input
              id="test-subject"
              placeholder="Apps Script Test Email"
              value={config.test_subject}
              onChange={(e) => updateConfig('test_subject', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">Test Email Message</Label>
            <Textarea
              id="test-message"
              placeholder="This is a test email to verify Apps Script configuration."
              value={config.test_message}
              onChange={(e) => updateConfig('test_message', e.target.value)}
              rows={3}
            />
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span className="text-sm">
                {testResult.success 
                  ? `Connection successful! Remaining quota: ${testResult.remainingQuota || 'Unknown'}`
                  : testResult.error
                }
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button 
              onClick={testAppsScriptConnectionHandler} 
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
                  <Globe className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

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
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Apps Script Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Apps Script Setup Guide</CardTitle>
          <CardDescription>
            How to create and deploy a Google Apps Script Web App for email sending
          </CardDescription>
        </CardHeader>
        <CardContent className="prose max-w-none text-sm">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">Step 1: Create a new Google Apps Script</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Go to <a href="https://script.google.com" target="_blank" className="text-blue-600 hover:underline">script.google.com</a></li>
                <li>Click "New Project"</li>
                <li>Replace the default code with email sending functions</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-semibold">Step 2: Deploy as Web App</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click "Deploy" → "New deployment"</li>
                <li>Choose "Web app" as the type</li>
                <li>Set execute as "Me" and access to "Anyone"</li>
                <li>Click "Deploy" and copy the Web App URL</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold">Step 3: Configure Permissions</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Grant necessary permissions when prompted</li>
                <li>Allow access to Gmail API for sending emails</li>
                <li>Test the deployment with the URL above</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppsScriptTestTool;
