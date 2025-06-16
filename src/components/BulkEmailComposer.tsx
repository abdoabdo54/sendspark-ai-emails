
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Send, 
  Users, 
  Settings, 
  FileText, 
  Loader2, 
  TestTube, 
  Cloud, 
  Zap,
  Mail,
  Calendar,
  Clock,
  Eye,
  Target,
  Sparkles,
  Upload,
  Download,
  Palette,
  Code,
  Globe,
  Shield
} from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  
  // Basic campaign settings
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'middleware'>('cloud_functions');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  // Advanced features restored
  const [enableTestMode, setEnableTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [enablePersonalization, setEnablePersonalization] = useState(false);
  const [personalizationFields, setPersonalizationFields] = useState('name,email,company');
  const [enableTracking, setEnableTracking] = useState(true);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [enableUnsubscribe, setEnableUnsubscribe] = useState(true);
  const [unsubscribeText, setUnsubscribeText] = useState('Unsubscribe from future emails');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [enableRetries, setEnableRetries] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(300);
  const [enableRateLimit, setEnableRateLimit] = useState(false);
  const [rateLimit, setRateLimit] = useState(100);
  const [rateLimitPeriod, setRateLimitPeriod] = useState<'minute' | 'hour' | 'day'>('hour');
  const [enablePreview, setEnablePreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'tablet'>('desktop');

  const activeAccounts = accounts.filter(account => account.is_active);
  
  // Auto-select first available account
  useEffect(() => {
    if (activeAccounts.length > 0 && !selectedAccount) {
      setSelectedAccount(activeAccounts[0].id);
    }
  }, [activeAccounts, selectedAccount]);

  const validateRecipients = (recipientList: string): boolean => {
    const emails = recipientList.split(',').map(email => email.trim()).filter(email => email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every(email => emailRegex.test(email));
  };

  const getRecipientCount = (): number => {
    return recipients.split(',').map(email => email.trim()).filter(email => email).length;
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const emails = text.split(/[,\n\r;]/).map(email => email.trim()).filter(email => email);
          setRecipients(emails.join(', '));
          toast.success(`Imported ${emails.length} recipients`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportTemplate = () => {
    const template = `Subject: ${subject || 'Your Email Subject'}
From: ${fromName || 'Your Name'}
HTML Content:
${htmlContent || 'Your HTML content here...'}

Text Content:
${textContent || 'Your text content here...'}`;
    
    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-template.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address');
      return;
    }
    if (!fromName.trim() || !subject.trim()) {
      toast.error('Please fill in From Name and Subject for testing');
      return;
    }
    if (!htmlContent.trim() && !textContent.trim()) {
      toast.error('Please add email content for testing');
      return;
    }

    setTesting(true);
    try {
      const testCampaignData = {
        from_name: fromName,
        subject: `[TEST] ${subject}`,
        recipients: testEmail,
        html_content: htmlContent,
        text_content: textContent,
        send_method: sendMethod,
        selected_account: selectedAccount,
        config: {
          sendMethod,
          selectedAccount,
          isTest: true,
          tracking: {
            track_opens: trackOpens,
            track_clicks: trackClicks
          },
          priority,
          reply_to: replyToEmail,
          custom_headers: customHeaders,
          retries: {
            enabled: enableRetries,
            max_retries: maxRetries,
            delay: retryDelay
          }
        }
      };

      console.log('🧪 Sending test email:', testCampaignData);
      await onSend(testCampaignData);
      toast.success('Test email sent successfully!');
    } catch (error) {
      console.error('Test email error:', error);
      toast.error('Test email failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async () => {
    // Validation
    if (!fromName.trim()) {
      toast.error('From name is required');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!recipients.trim()) {
      toast.error('Recipients are required');
      return;
    }
    if (!htmlContent.trim() && !textContent.trim()) {
      toast.error('Email content is required');
      return;
    }
    if (!validateRecipients(recipients)) {
      toast.error('Please enter valid email addresses separated by commas');
      return;
    }

    setSending(true);
    
    try {
      const campaignData = {
        from_name: fromName,
        subject,
        recipients,
        html_content: htmlContent,
        text_content: textContent,
        send_method: sendMethod,
        selected_account: selectedAccount,
        config: {
          sendMethod,
          selectedAccount,
          scheduling: enableScheduling ? {
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime
          } : null,
          personalization: enablePersonalization ? {
            enabled: true,
            fields: personalizationFields.split(',').map(f => f.trim())
          } : null,
          tracking: {
            track_opens: trackOpens,
            track_clicks: trackClicks,
            enable_unsubscribe: enableUnsubscribe,
            unsubscribe_text: unsubscribeText
          },
          priority,
          reply_to: replyToEmail,
          custom_headers: customHeaders,
          retries: {
            enabled: enableRetries,
            max_retries: maxRetries,
            delay: retryDelay
          },
          rate_limiting: enableRateLimit ? {
            enabled: true,
            limit: rateLimit,
            period: rateLimitPeriod
          } : null
        }
      };

      console.log(`🚀 Creating campaign with send method: ${sendMethod}`);
      await onSend(campaignData);
      
      // Reset form after successful send
      setFromName('');
      setSubject('');
      setRecipients('');
      setHtmlContent('');
      setTextContent('');
      setSelectedAccount(activeAccounts.length > 0 ? activeAccounts[0].id : '');
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Loading email accounts...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Professional Bulk Email Campaign
            <Badge variant="outline">Enhanced</Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Send Method Selection */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            1. Choose Send Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant={sendMethod === 'cloud_functions' ? 'default' : 'outline'}
              onClick={() => setSendMethod('cloud_functions')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Cloud className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold">Google Cloud Functions</div>
                <div className="text-xs opacity-70">Ultra-fast direct sending</div>
              </div>
            </Button>

            <Button
              variant={sendMethod === 'middleware' ? 'default' : 'outline'}
              onClick={() => setSendMethod('middleware')}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Zap className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold flex items-center gap-1">
                  PowerMTA Middleware
                  <Badge variant="outline" className="text-xs">Pro</Badge>
                </div>
                <div className="text-xs opacity-70">Advanced monitoring & control</div>
              </div>
            </Button>
          </div>
          
          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription>
              {sendMethod === 'cloud_functions' && 
                "⚡ Google Cloud Functions: Ultra-fast sending using your SMTP/Apps Script accounts with automatic scaling and reliability."
              }
              {sendMethod === 'middleware' && 
                "🚀 PowerMTA Middleware: Professional-grade email distribution with real-time monitoring, pause/resume control, and detailed analytics via PowerMTA dashboard."
              }
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Campaign Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                2. Campaign Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name *</Label>
                  <Input
                    id="fromName"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Your Name or Company"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Your email subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="replyTo">Reply-To Email</Label>
                  <Input
                    id="replyTo"
                    type="email"
                    value={replyToEmail}
                    onChange={(e) => setReplyToEmail(e.target.value)}
                    placeholder="reply@yourcompany.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Email Priority</Label>
                  <Select value={priority} onValueChange={(value: 'low' | 'normal' | 'high') => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="normal">Normal Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Account Selection */}
              {activeAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="account">Email Account</Label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select email account" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.email}) - {account.type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                3. Recipients
                {getRecipientCount() > 0 && (
                  <Badge variant="secondary">{getRecipientCount()} recipients</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleImportCSV} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Button onClick={handleExportTemplate} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Template
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="recipients">Email Addresses *</Label>
                <Textarea
                  id="recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="Enter email addresses separated by commas"
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  Separate multiple email addresses with commas. You can also import from CSV files.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                4. Email Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={() => setEnablePreview(!enablePreview)} variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  {enablePreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
                {enablePreview && (
                  <Select value={previewMode} onValueChange={(value: 'desktop' | 'mobile' | 'tablet') => setPreviewMode(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="htmlContent">HTML Content *</Label>
                <Textarea
                  id="htmlContent"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Enter your HTML email content here..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="textContent">Plain Text Content (Fallback)</Label>
                <Textarea
                  id="textContent"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter plain text version (optional but recommended)..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Features Sidebar */}
        <div className="space-y-6">
          {/* Test Email */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                Test Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="test-mode"
                  checked={enableTestMode}
                  onCheckedChange={setEnableTestMode}
                />
                <Label htmlFor="test-mode" className="text-sm">Enable Testing</Label>
              </div>
              
              {enableTestMode && (
                <div className="space-y-3">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                  <Button
                    onClick={handleTestEmail}
                    disabled={testing || !testEmail.trim()}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="scheduling"
                  checked={enableScheduling}
                  onCheckedChange={setEnableScheduling}
                />
                <Label htmlFor="scheduling" className="text-sm">Schedule Campaign</Label>
              </div>
              
              {enableScheduling && (
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                Tracking & Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="tracking"
                  checked={enableTracking}
                  onCheckedChange={setEnableTracking}
                />
                <Label htmlFor="tracking" className="text-sm">Enable Tracking</Label>
              </div>
              
              {enableTracking && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="track-opens"
                      checked={trackOpens}
                      onCheckedChange={setTrackOpens}
                    />
                    <Label htmlFor="track-opens" className="text-sm">Track Opens</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="track-clicks"
                      checked={trackClicks}
                      onCheckedChange={setTrackClicks}
                    />
                    <Label htmlFor="track-clicks" className="text-sm">Track Clicks</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="unsubscribe"
                      checked={enableUnsubscribe}
                      onCheckedChange={setEnableUnsubscribe}
                    />
                    <Label htmlFor="unsubscribe" className="text-sm">Unsubscribe Link</Label>
                  </div>
                  
                  {enableUnsubscribe && (
                    <Input
                      value={unsubscribeText}
                      onChange={(e) => setUnsubscribeText(e.target.value)}
                      placeholder="Unsubscribe text"
                      className="text-xs"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personalization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Personalization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="personalization"
                  checked={enablePersonalization}
                  onCheckedChange={setEnablePersonalization}
                />
                <Label htmlFor="personalization" className="text-sm">Enable Personalization</Label>
              </div>
              
              {enablePersonalization && (
                <div className="space-y-2">
                  <Label className="text-xs">Available Fields</Label>
                  <Input
                    value={personalizationFields}
                    onChange={(e) => setPersonalizationFields(e.target.value)}
                    placeholder="name,email,company"
                    className="text-xs"
                  />
                  <p className="text-xs text-gray-500">
                    Use {'{{'} name {'}}'}, {'{{'} email {'}}'}, etc. in your content
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rate Limiting */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Rate Limiting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="rate-limit"
                  checked={enableRateLimit}
                  onCheckedChange={setEnableRateLimit}
                />
                <Label htmlFor="rate-limit" className="text-sm">Enable Rate Limiting</Label>
              </div>
              
              {enableRateLimit && (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(parseInt(e.target.value) || 100)}
                    placeholder="100"
                    min="1"
                  />
                  <Select value={rateLimitPeriod} onValueChange={(value: 'minute' | 'hour' | 'day') => setRateLimitPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minute">Per Minute</SelectItem>
                      <SelectItem value="hour">Per Hour</SelectItem>
                      <SelectItem value="day">Per Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retry Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Retry Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="retries"
                  checked={enableRetries}
                  onCheckedChange={setEnableRetries}
                />
                <Label htmlFor="retries" className="text-sm">Enable Retries</Label>
              </div>
              
              {enableRetries && (
                <div className="space-y-2">
                  <Label className="text-xs">Max Retries</Label>
                  <Input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                    min="1"
                    max="10"
                  />
                  <Label className="text-xs">Retry Delay (seconds)</Label>
                  <Input
                    type="number"
                    value={retryDelay}
                    onChange={(e) => setRetryDelay(parseInt(e.target.value) || 300)}
                    min="60"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Headers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Code className="w-4 h-4" />
                Custom Headers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={customHeaders}
                onChange={(e) => setCustomHeaders(e.target.value)}
                placeholder="X-Custom-Header: value"
                rows={3}
                className="text-xs font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                One header per line: Header-Name: value
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          {activeAccounts.length === 0 ? (
            <Alert>
              <Settings className="w-4 h-4" />
              <AlertDescription>
                No active email accounts found. Please add an email account first in the Accounts tab.
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              onClick={handleSend}
              disabled={sending || !fromName || !subject || !recipients || (!htmlContent && !textContent)}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign ({getRecipientCount()} recipients) - {sendMethod === 'cloud_functions' ? 'Cloud Functions' : 'PowerMTA Middleware'}
                  {enableScheduling && scheduledDate && ' (Scheduled)'}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
