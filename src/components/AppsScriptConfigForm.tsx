
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

  const appsScriptCode = `// Enhanced Google Apps Script Web App for Email Sending
// Deploy this as a Web App with Execute as "Me" and access to "Anyone"

function doGet(e) {
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Apps Script Web App is active and ready',
        remainingQuota: remaining,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  } catch (err) {
    console.error('Error in doGet:', err);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Failed to get status: ' + err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Parse incoming data
    let params;
    try {
      params = JSON.parse(e.postData.getDataAsString());
    } catch (parseError) {
      throw new Error('Invalid JSON in request body');
    }

    // Validate required fields
    const { to, subject, htmlBody, plainBody, fromName, fromAlias, cc, bcc } = params;
    
    if (!to || !subject) {
      throw new Error("Missing required parameters: 'to' and 'subject' are required");
    }

    if (!htmlBody && !plainBody) {
      throw new Error("Missing email body: either 'htmlBody' or 'plainBody' must be provided");
    }

    // Prepare email options
    const emailOptions = {};

    // Set HTML body (preferred)
    if (htmlBody && htmlBody.trim() !== "") {
      emailOptions.htmlBody = htmlBody.trim();
    }
    
    // Set plain text body as fallback or alternative
    if (plainBody && plainBody.trim() !== "") {
      emailOptions.body = plainBody.trim();
    }

    // Set sender name
    if (fromName && fromName.trim() !== "") {
      emailOptions.name = fromName.trim();
    }

    // Set reply-to address
    if (fromAlias && fromAlias.trim() !== "") {
      emailOptions.replyTo = fromAlias.trim();
    }

    // Set CC recipients
    if (cc && cc.trim() !== "") {
      emailOptions.cc = cc.trim();
    }

    // Set BCC recipients
    if (bcc && bcc.trim() !== "") {
      emailOptions.bcc = bcc.trim();
    }

    // Send email using GmailApp for better formatting support
    try {
      if (emailOptions.htmlBody) {
        // Use GmailApp for HTML emails
        GmailApp.sendEmail(to, subject, emailOptions.body || '', emailOptions);
      } else {
        // Use MailApp for plain text emails
        MailApp.sendEmail(to, subject, emailOptions.body || '', emailOptions);
      }
    } catch (sendError) {
      throw new Error('Email sending failed: ' + sendError.toString());
    }

    // Get remaining quota
    const remaining = MailApp.getRemainingDailyQuota();
    
    // Log successful send
    console.log('Email sent successfully to:', to);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Email sent successfully via Google Apps Script',
        remainingQuota: remaining,
        recipient: to,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);

  } catch (err) {
    console.error('Error in doPost:', err);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Failed to send email: ' + err.toString(),
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  }
}

// Handle preflight OPTIONS requests for CORS
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Google Apps Script Web App Configuration
        </CardTitle>
        <CardDescription>
          Configure your Google Apps Script Web App deployment for professional email sending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="exec-url">Web App Execution URL *</Label>
          <Input
            id="exec-url"
            placeholder="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
            value={config.exec_url}
            onChange={(e) => updateConfig('exec_url', e.target.value)}
          />
          <p className="text-xs text-slate-500">
            This is the web app URL from your deployed Google Apps Script project
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
            Maximum emails per day (Google Apps Script limit: 100 for free, 1500 for Google Workspace)
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
                ? `Web App is active! Remaining quota: ${testResult.remainingQuota}` 
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
              Testing Web App Connection...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4 mr-2" />
              Test Apps Script Web App
            </>
          )}
        </Button>

        <Separator />

        {/* Setup Instructions */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Web App Setup Instructions
          </h4>
          <div className="text-sm text-slate-600 space-y-2">
            <p><strong>1.</strong> Go to <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">script.google.com</a></p>
            <p><strong>2.</strong> Create a new project and paste the provided code below</p>
            <p><strong>3.</strong> Save the project with a meaningful name</p>
            <p><strong>4.</strong> Click Deploy → New deployment</p>
            <p><strong>5.</strong> Choose "Web app" as the type</p>
            <p><strong>6.</strong> Set Execute as: "Me" and access to: "Anyone"</p>
            <p><strong>7.</strong> Click Deploy and copy the Web App URL</p>
            <p><strong>8.</strong> Paste the URL above and test the connection</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Code className="w-4 h-4 mr-2" />
                View Enhanced Web App Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Google Apps Script Web App Code</DialogTitle>
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
