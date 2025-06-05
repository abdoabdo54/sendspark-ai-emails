
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TestTube, Loader2, CheckCircle, XCircle, ExternalLink, Code } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { testAppsScriptConnection } from '@/utils/appsScriptSender';

interface AppsScriptConfig {
  script_id: string;
  deployment_id: string;
  daily_quota: number;
  exec_url: string;
}

interface AppsScriptConfigFormProps {
  config: AppsScriptConfig;
  onChange: (config: AppsScriptConfig) => void;
}

const AppsScriptConfigForm = ({ config, onChange }: AppsScriptConfigFormProps) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; remainingQuota?: number } | null>(null);

  const updateConfig = (field: keyof AppsScriptConfig, value: any) => {
    setTestResult(null);
    onChange({
      ...config,
      [field]: value
    });
  };

  const handleTestConnection = async () => {
    if (!config.exec_url.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter the Google Apps Script execution URL",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testAppsScriptConnection(config);
      setTestResult(result);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Google Apps Script is active. Remaining quota: ${result.remainingQuota}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Apps Script connection failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({ success: false, error: errorMessage });
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const appsScriptCode = `// Apps Script Email Sender with HTML Support
function doGet(e) {
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Apps Script is active',
        remainingQuota: remaining
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.getDataAsString());
    const to = params.to;
    const subject = params.subject;
    const htmlBody = params.htmlBody;
    const plainBody = params.plainBody;
    const fromName = params.fromName;
    const fromAlias = params.fromAlias;
    const cc = params.cc;
    const bcc = params.bcc;

    if (!to || !subject) {
      throw new Error("Missing required parameters: to or subject");
    }

    if (!htmlBody && !plainBody) {
      throw new Error("Missing email body: htmlBody or plainBody must be provided");
    }

    const options = {};

    // Set HTML body if provided
    if (htmlBody) {
      options.htmlBody = htmlBody;
    }
    
    // Set plain text body if provided
    if (plainBody) {
      options.body = plainBody;
    }

    // Set sender name
    if (fromName && fromName.trim() !== "") {
      options.name = fromName.trim();
    }

    // Set from alias if provided
    if (fromAlias && fromAlias.trim() !== "") {
      options.from = fromAlias.trim();
    }

    // Set CC if provided
    if (cc && cc.trim() !== "") {
      options.cc = cc.trim();
    }

    // Set BCC if provided
    if (bcc && bcc.trim() !== "") {
      options.bcc = bcc.trim();
    }

    // Send the email using GmailApp for better HTML support
    GmailApp.sendEmail(to, subject, plainBody || "", options);

    const remaining = MailApp.getRemainingDailyQuota();
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Email sent successfully',
        remainingQuota: remaining
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Failed to send email: ' + err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Google Apps Script Configuration
        </CardTitle>
        <CardDescription>
          Configure your Google Apps Script deployment for email sending with HTML support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exec-url">Execution URL (EXEC URL)</Label>
          <Input
            id="exec-url"
            placeholder="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
            value={config.exec_url}
            onChange={(e) => updateConfig('exec_url', e.target.value)}
          />
          <p className="text-xs text-slate-500">
            This is the execution URL from your deployed Google Apps Script web app
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="script-id">Script ID (Optional)</Label>
            <Input
              id="script-id"
              placeholder="1a2b3c4d5e6f7g8h9i0j"
              value={config.script_id}
              onChange={(e) => updateConfig('script_id', e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Google Apps Script project ID for reference
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deployment-id">Deployment ID (Optional)</Label>
            <Input
              id="deployment-id"
              placeholder="AKfycby..."
              value={config.deployment_id}
              onChange={(e) => updateConfig('deployment_id', e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Web app deployment ID for reference
            </p>
          </div>
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
            Maximum emails per day (Google Apps Script limit is typically 100-1000)
          </p>
        </div>

        <Separator />

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
                ? `Connection successful! Remaining quota: ${testResult.remainingQuota}` 
                : testResult.error
              }
            </span>
          </div>
        )}

        <Button 
          onClick={handleTestConnection} 
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
              Test Apps Script Connection
            </>
          )}
        </Button>

        <Separator />

        {/* Setup Instructions */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Setup Instructions
          </h4>
          <div className="text-sm text-slate-600 space-y-2">
            <p>1. Go to <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">script.google.com</a></p>
            <p>2. Create a new project and paste the provided code</p>
            <p>3. Deploy as Web App: Deploy → New deployment → Web app</p>
            <p>4. Set Execute as "Me" and access to "Anyone"</p>
            <p>5. Copy the EXEC URL and paste it above</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Code className="w-4 h-4 mr-2" />
                View Enhanced Apps Script Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Google Apps Script Code (HTML Support)</DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-auto">
                <Textarea
                  value={appsScriptCode}
                  readOnly
                  className="min-h-[400px] font-mono text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigator.clipboard.writeText(appsScriptCode)}
                  variant="outline"
                  size="sm"
                >
                  Copy Code
                </Button>
                <Button
                  onClick={() => window.open('https://script.google.com', '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open Google Apps Script
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppsScriptConfigForm;
