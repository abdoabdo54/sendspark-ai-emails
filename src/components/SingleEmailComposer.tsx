
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TestTube, Send, Mail, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { sendEmailViaSMTP } from '@/utils/emailSender';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';

interface SingleEmailComposerProps {
  onSend?: (emailData: any) => void;
}

const SingleEmailComposer: React.FC<SingleEmailComposerProps> = ({ onSend }) => {
  const [accountType, setAccountType] = useState<'smtp' | 'apps-script'>('smtp');
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Email data
  const [fromName, setFromName] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('Test Email');
  const [htmlContent, setHtmlContent] = useState('<h1>Test Email</h1><p>This is a test email to verify email configuration.</p>');
  const [textContent, setTextContent] = useState('Test Email\n\nThis is a test email to verify email configuration.');

  // SMTP Configuration
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls' as 'none' | 'tls' | 'ssl',
    auth_required: true
  });

  // Apps Script Configuration
  const [appsScriptConfig, setAppsScriptConfig] = useState({
    exec_url: '',
    daily_quota: 100
  });

  const handleSendTest = async () => {
    if (!recipient.trim() || !subject.trim() || !fromName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in From Name, Recipient, and Subject",
        variant: "destructive"
      });
      return;
    }

    if (accountType === 'smtp') {
      if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
        toast({
          title: "Missing SMTP Configuration",
          description: "Please fill in all SMTP settings",
          variant: "destructive"
        });
        return;
      }
    } else {
      if (!appsScriptConfig.exec_url) {
        toast({
          title: "Missing Apps Script URL",
          description: "Please enter the Apps Script execution URL",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSending(true);

    try {
      let result;

      if (accountType === 'smtp') {
        result = await sendEmailViaSMTP(
          smtpConfig,
          smtpConfig.username, // from email
          fromName,
          recipient,
          subject,
          htmlContent,
          textContent
        );
      } else {
        result = await sendEmailViaAppsScript(
          appsScriptConfig,
          smtpConfig.username || 'test@example.com', // from email (Apps Script will use the authenticated user's email)
          fromName,
          recipient,
          subject,
          htmlContent,
          textContent
        );
      }

      if (result.success) {
        toast({
          title: "Email Sent Successfully!",
          description: `Test email sent to ${recipient} via ${accountType.toUpperCase()}`,
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
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Email Account Testing Tool
          </CardTitle>
          <CardDescription>
            Test your SMTP or Apps Script configuration by sending a test email without saving the account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Type Selection */}
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={(value: 'smtp' | 'apps-script') => setAccountType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">SMTP Server</SelectItem>
                <SelectItem value="apps-script">Google Apps Script</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Account Configuration */}
          {accountType === 'smtp' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">SMTP Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.gmail.com"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="587"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-username">Username/Email</Label>
                <Input
                  id="smtp-username"
                  type="email"
                  placeholder="your-email@gmail.com"
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-password">Password</Label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password or app-specific password"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, password: e.target.value }))}
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
                <Label>Encryption</Label>
                <Select value={smtpConfig.encryption} onValueChange={(value: any) => setSmtpConfig(prev => ({ ...prev, encryption: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Plain)</SelectItem>
                    <SelectItem value="tls">TLS/STARTTLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Apps Script Configuration</h3>
              
              <div className="space-y-2">
                <Label htmlFor="apps-script-url">Apps Script Web App URL</Label>
                <Input
                  id="apps-script-url"
                  placeholder="https://script.google.com/macros/s/your-script-id/exec"
                  value={appsScriptConfig.exec_url}
                  onChange={(e) => setAppsScriptConfig(prev => ({ ...prev, exec_url: e.target.value }))}
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
                  value={appsScriptConfig.daily_quota}
                  onChange={(e) => setAppsScriptConfig(prev => ({ ...prev, daily_quota: parseInt(e.target.value) || 100 }))}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Email Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Email Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Test Sender"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Email</Label>
                <Input
                  id="recipient"
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Test Email Subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="htmlContent">Email Content (HTML)</Label>
              <Textarea
                id="htmlContent"
                placeholder="<h1>Test Email</h1><p>Your test email content here...</p>"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textContent">Plain Text Version</Label>
              <Textarea
                id="textContent"
                placeholder="Test Email - Your plain text content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <Button 
            onClick={handleSendTest}
            className="w-full"
            size="lg"
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Mail className="w-4 h-4 mr-2 animate-pulse" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Test Email via {accountType.toUpperCase()}
              </>
            )}
          </Button>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Testing Notes:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• This tool tests your email configuration without saving the account</li>
              <li>• SMTP: Make sure to use app-specific passwords for Gmail/Outlook</li>
              <li>• Apps Script: Ensure your script is deployed as a Web App with proper permissions</li>
              <li>• Check your spam folder if you don't receive the test email</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SingleEmailComposer;
