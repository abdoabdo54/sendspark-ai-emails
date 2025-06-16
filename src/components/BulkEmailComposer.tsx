
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
import { toast } from 'sonner';
import { Send, Users, Settings, FileText, Loader2, TestTube, Cloud, Zap } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'middleware'>('cloud_functions');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enableTestMode, setEnableTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');

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
          isTest: true
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
          selectedAccount
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Bulk Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Send Method Selection */}
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Send Method Selection
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
                    <div className="text-xs opacity-70">Direct cloud sending</div>
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
                      <Badge variant="outline" className="text-xs">Advanced</Badge>
                    </div>
                    <div className="text-xs opacity-70">Apps Script + PowerMTA Control</div>
                  </div>
                </Button>
              </div>
              
              <div className="text-xs text-gray-600 bg-white p-3 rounded border">
                {sendMethod === 'cloud_functions' && (
                  "✨ Fast and reliable sending using Google Cloud Functions with your configured email accounts"
                )}
                {sendMethod === 'middleware' && (
                  "⚡ Advanced middleware that uses PowerMTA for monitoring, pausing, and resuming while sending emails via Google Apps Script. Best of both worlds!"
                )}
              </div>
            </CardContent>
          </Card>

          {/* Campaign Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name or Company"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label htmlFor="recipients" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recipients
              {getRecipientCount() > 0 && (
                <Badge variant="secondary">{getRecipientCount()} recipients</Badge>
              )}
            </Label>
            <Textarea
              id="recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Enter email addresses separated by commas"
              rows={3}
            />
          </div>

          <Separator />

          {/* Email Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <Label>Email Content</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="htmlContent">HTML Content</Label>
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="Enter your HTML email content here..."
                rows={8}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="textContent">Plain Text Content (Optional)</Label>
              <Textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Enter plain text version (optional)..."
                rows={4}
              />
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

          {/* Test Email Section */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Switch
                  id="test-mode"
                  checked={enableTestMode}
                  onCheckedChange={setEnableTestMode}
                />
                <Label htmlFor="test-mode" className="flex items-center gap-2">
                  <TestTube className="w-4 h-4" />
                  Enable Test Mode
                </Label>
              </div>
              
              {enableTestMode && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="testEmail">Test Email Address</Label>
                    <Input
                      id="testEmail"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                    />
                  </div>
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
                        Sending Test...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {activeAccounts.length === 0 && (
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Settings className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-yellow-800">No active email accounts found. Please add an email account first.</p>
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || activeAccounts.length === 0 || !fromName || !subject || !recipients || (!htmlContent && !textContent)}
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
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
