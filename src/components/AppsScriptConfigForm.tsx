
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
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; quota?: number } | null>(null);

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
      // Test the Apps Script connection
      const response = await fetch(`${config.exec_url}?action=status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult({ 
          success: true, 
          quota: result.remainingQuota 
        });
        toast({
          title: "Connection Successful",
          description: `Google Apps Script is active. Remaining quota: ${result.remainingQuota}`,
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  const appsScriptCode = `// Apps Script Mailer
// IMPORTANT: After deploying this script as a Web App, use the *EXEC* URL (e.g., https://script.google.com/macros/s/ABCDE12345/exec)
// To deploy: Deploy → New deployment → Select "Web app" → Execute as "Me" → Who has access "Anyone" → Deploy → Copy the **EXEC** URL.

const JSON_MIME_TYPE = ContentService.MimeType.JSON;
const TEXT_MIME_TYPE = ContentService.MimeType.TEXT; // For returning CSV

/**
 * doGet: Handles GET requests.
 * Can be used for:
 *   1. Simple status check (no params or action=status).
 *   2. Fetching data from a Google Sheet (action=getSheetData&sheetUrl=URL_ENCODED_SHEET_LINK).
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === "getSheetData") {
      const sheetUrl = e.parameter.sheetUrl;
      if (!sheetUrl) {
        return createErrorResponse("Missing 'sheetUrl' parameter for getSheetData action.", JSON_MIME_TYPE);
      }
      return getCsvDataFromSheet(sheetUrl);
    } else { // Default or status check
      const remaining = MailApp.getRemainingDailyQuota();
      return createSuccessResponse('Mailer is active', remaining, JSON_MIME_TYPE);
    }
  } catch (err) {
    Logger.log("Error in doGet: " + err.toString() + (err.stack ? "\\nStack: " + err.stack : ""));
    return createErrorResponse('Error processing GET request: ' + err.toString(), JSON_MIME_TYPE);
  }
}

/**
 * Fetches data from a Google Sheet URL and returns it as CSV text.
 */
function getCsvDataFromSheet(sheetUrl) {
  try {
    const spreadsheet = SpreadsheetApp.openByUrl(sheetUrl);
    const sheet = spreadsheet.getSheets()[0]; // Get the first sheet
    if (!sheet) {
      return createErrorResponse("No sheets found in the Google Sheet.", TEXT_MIME_TYPE);
    }
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length === 0) {
      return createErrorResponse("Google Sheet is empty or no data found.", TEXT_MIME_TYPE);
    }

    // Convert array of arrays to CSV string
    const csvContent = data.map(row => {
      return row.map(cell => {
        let cellValue = cell.toString();
        // Handle quotes and commas in cell values
        if (cellValue.includes('"') || cellValue.includes(',')) {
          cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
        }
        return cellValue;
      }).join(',');
    }).join('\\n');
    
    // Return as plain text
    return ContentService.createTextOutput(csvContent).setMimeType(TEXT_MIME_TYPE);

  } catch (err) {
    Logger.log("Error in getCsvDataFromSheet (URL: " + sheetUrl + "): " + err.toString() + (err.stack ? "\\nStack: " + err.stack : ""));
    // Return error as plain text because client might expect CSV or error text
    return createErrorResponse('Failed to get data from Google Sheet: ' + err.toString(), TEXT_MIME_TYPE, 500); // 500 for server error
  }
}

/**
 * doPost: main entrypoint for sending emails
 * Expects JSON body with keys: 
 *   to (string, required), 
 *   subject (string, required), 
 *   htmlBody (string, optional), 
 *   plainBody (string, optional),
 *   fromName (string, optional for display name), 
 *   fromAlias (string, optional), 
 *   cc (string, optional), 
 *   bcc (string, optional), 
 *   attachments (array of strings, optional blob IDs)
 * POST to the EXEC URL.
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.getDataAsString());
    const to          = params.to;
    const subject     = params.subject;
    const htmlBody    = params.htmlBody;   
    const plainBody   = params.plainBody;  
    const fromName    = params.fromName;   
    const fromAlias   = params.fromAlias;
    const cc          = params.cc;
    const bcc         = params.bcc;
    const attachments = params.attachments || [];

    if (!to || !subject) { 
      return createErrorResponse("Missing required parameters: to or subject.", JSON_MIME_TYPE);
    }
    if (!htmlBody && !plainBody) { 
        return createErrorResponse("Missing email body: htmlBody or plainBody must be provided.", JSON_MIME_TYPE);
    }

    const options = {}; 

    if (htmlBody) {
        options.htmlBody = htmlBody;
    }
    if (plainBody) {
        options.body = plainBody; 
    }
    
    if (fromAlias && fromAlias.trim() !== "") {
      options.from = fromAlias.trim(); 
    }
    
    if (fromName && fromName.trim() !== "") {
        if (!options.from || !options.from.includes("<")) { 
            options.name = fromName.trim(); 
        }
    }

    if (cc && cc.trim() !== "") options.cc = cc.trim();
    if (bcc && bcc.trim() !== "") options.bcc = bcc.trim();
    
    if (attachments.length) {
      try {
        options.attachments = attachments.map(id => {
          if (typeof id !== 'string' || id.trim() === '') {
            throw new Error("Invalid attachment ID found: " + id);
          }
          return DriveApp.getFileById(id.trim()).getBlob();
        });
      } catch (attachErr) {
        Logger.log("Attachment processing error: " + attachErr.toString());
        return createErrorResponse('Failed to process attachments: ' + attachErr.toString(), JSON_MIME_TYPE);
      }
    }

    GmailApp.sendEmail(to, subject, "", options); 

    const remaining = MailApp.getRemainingDailyQuota();
    return createSuccessResponse('Email sent successfully', remaining, JSON_MIME_TYPE);

  } catch (err) {
    Logger.log("Error in doPost: " + err.toString() + (err.stack ? "\\nStack: " + err.stack : ""));
    return createErrorResponse('Failed to send email: ' + err.toString(), JSON_MIME_TYPE);
  }
}

/**
 * createSuccessResponse: helper to build standardized JSON success output
 */
function createSuccessResponse(message, quota, mimeType) {
  const payload = {
    status: 'success',
    message: message,
    remainingQuota: quota 
  };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(mimeType || JSON_MIME_TYPE);
}

/**
 * createErrorResponse: helper to build standardized JSON error output
 * For text responses (like CSV fetch errors), it just returns the message.
 */
function createErrorResponse(message, mimeType, httpStatusCode) {
  if (mimeType === TEXT_MIME_TYPE) {
    var output = ContentService.createTextOutput("Error: " + message).setMimeType(TEXT_MIME_TYPE);
    // Note: ContentService does not directly support setting HTTP status codes for textOutput easily in a way that all clients reliably interpret.
    // The Python client will check response.ok and response.text.
    return output;
  }
  const payload = {
    status: 'error',
    message: message
  };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(mimeType || JSON_MIME_TYPE);
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5" />
          Google Apps Script Configuration
        </CardTitle>
        <CardDescription>
          Configure your Google Apps Script deployment for email sending
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
                ? `Connection successful! Remaining quota: ${testResult.quota}` 
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
                View Apps Script Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Google Apps Script Code</DialogTitle>
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
