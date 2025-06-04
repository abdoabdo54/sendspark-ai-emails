
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestTube, Send, Copy, Trash2, Eye, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';
import { sendEmailViaSMTP } from '@/utils/emailSender';

interface TestCampaign {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  htmlContent: string;
  textContent: string;
  testEmails: string;
  selectedAccount: string;
  created: string;
}

const CampaignTesting = () => {
  const { currentOrganization } = useOrganizations();
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  const [testCampaigns, setTestCampaigns] = useState<TestCampaign[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState<string | null>(null);

  // Form state for new test campaign
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    fromName: '',
    htmlContent: '',
    textContent: '',
    testEmails: '',
    selectedAccount: ''
  });

  const activeAccounts = accounts.filter(acc => acc.is_active);

  const handleCreateTestCampaign = () => {
    if (!formData.name || !formData.subject || !formData.htmlContent || !formData.testEmails) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const newTest: TestCampaign = {
      id: Date.now().toString(),
      ...formData,
      created: new Date().toISOString()
    };

    setTestCampaigns(prev => [newTest, ...prev]);
    setFormData({
      name: '',
      subject: '',
      fromName: '',
      htmlContent: '',
      textContent: '',
      testEmails: '',
      selectedAccount: ''
    });
    setIsCreating(false);

    toast({
      title: "Test Campaign Created",
      description: "Your test campaign has been created successfully"
    });
  };

  const handleSendTest = async (testCampaign: TestCampaign) => {
    const account = accounts.find(acc => acc.id === testCampaign.selectedAccount);
    if (!account) {
      toast({
        title: "No Account Selected",
        description: "Please select an email account for testing",
        variant: "destructive"
      });
      return;
    }

    const testEmails = testCampaign.testEmails.split(',').map(email => email.trim()).filter(email => email);
    if (testEmails.length === 0) {
      toast({
        title: "No Test Emails",
        description: "Please provide test email addresses",
        variant: "destructive"
      });
      return;
    }

    setIsSending(testCampaign.id);

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const email of testEmails) {
        try {
          let result;
          if (account.type === 'apps-script') {
            result = await sendEmailViaAppsScript(
              account.config,
              account.email,
              testCampaign.fromName || account.name,
              email,
              `[TEST] ${testCampaign.subject}`,
              testCampaign.htmlContent,
              testCampaign.textContent
            );
          } else if (account.type === 'smtp') {
            result = await sendEmailViaSMTP(
              account.config,
              account.email,
              testCampaign.fromName || account.name,
              email,
              `[TEST] ${testCampaign.subject}`,
              testCampaign.htmlContent,
              testCampaign.textContent
            );
          }

          if (result?.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }

      toast({
        title: "Test Campaign Sent",
        description: `Successfully sent to ${successCount} recipients${failureCount > 0 ? `, ${failureCount} failed` : ''}`
      });

    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to send test campaign",
        variant: "destructive"
      });
    } finally {
      setIsSending(null);
    }
  };

  const handleDuplicate = (testCampaign: TestCampaign) => {
    const duplicate: TestCampaign = {
      ...testCampaign,
      id: Date.now().toString(),
      name: `${testCampaign.name} (Copy)`,
      created: new Date().toISOString()
    };
    setTestCampaigns(prev => [duplicate, ...prev]);
    toast({
      title: "Test Campaign Duplicated",
      description: "Test campaign has been duplicated successfully"
    });
  };

  const handleDelete = (id: string) => {
    setTestCampaigns(prev => prev.filter(test => test.id !== id));
    toast({
      title: "Test Campaign Deleted",
      description: "Test campaign has been deleted successfully"
    });
  };

  const handlePreview = (testCampaign: TestCampaign) => {
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Email Preview - ${testCampaign.subject}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .content { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Email Preview</h2>
              <p><strong>Subject:</strong> ${testCampaign.subject}</p>
              <p><strong>From:</strong> ${testCampaign.fromName}</p>
            </div>
            <div class="content">
              ${testCampaign.htmlContent}
            </div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campaign Testing</h2>
          <p className="text-slate-600">Create and test email campaigns before sending to your lists</p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <TestTube className="w-4 h-4 mr-2" />
          Create Test Campaign
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Test Campaign</CardTitle>
            <CardDescription>Design and configure your test campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-name">Campaign Name *</Label>
                <Input
                  id="test-name"
                  placeholder="My Test Campaign"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-from-name">From Name</Label>
                <Input
                  id="test-from-name"
                  placeholder="Your Name"
                  value={formData.fromName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-subject">Email Subject *</Label>
              <Input
                id="test-subject"
                placeholder="Your email subject line"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-html">HTML Content *</Label>
              <Textarea
                id="test-html"
                placeholder="<h1>Hello!</h1><p>This is your email content...</p>"
                className="min-h-[150px] font-mono"
                value={formData.htmlContent}
                onChange={(e) => setFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-text">Plain Text Content</Label>
              <Textarea
                id="test-text"
                placeholder="Hello! This is your email content in plain text..."
                className="min-h-[100px]"
                value={formData.textContent}
                onChange={(e) => setFormData(prev => ({ ...prev, textContent: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-emails">Test Email Addresses *</Label>
                <Textarea
                  id="test-emails"
                  placeholder="test@example.com, another@example.com"
                  value={formData.testEmails}
                  onChange={(e) => setFormData(prev => ({ ...prev, testEmails: e.target.value }))}
                />
                <p className="text-xs text-slate-500">Separate multiple emails with commas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-account">Email Account</Label>
                <Select 
                  value={formData.selectedAccount} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, selectedAccount: value }))}
                >
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
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTestCampaign}>
                Create Test Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {testCampaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TestTube className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No test campaigns created</h3>
              <p className="text-slate-500 text-center mb-4">
                Create your first test campaign to start testing email delivery
              </p>
            </CardContent>
          </Card>
        ) : (
          testCampaigns.map((testCampaign) => (
            <Card key={testCampaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{testCampaign.name}</CardTitle>
                    <CardDescription>{testCampaign.subject}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Test Campaign</Badge>
                    <Badge variant="secondary">
                      {new Date(testCampaign.created).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    <p><strong>From:</strong> {testCampaign.fromName || 'Default'}</p>
                    <p><strong>Test Emails:</strong> {testCampaign.testEmails}</p>
                    {testCampaign.selectedAccount && (
                      <p><strong>Account:</strong> {accounts.find(acc => acc.id === testCampaign.selectedAccount)?.name}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSendTest(testCampaign)}
                      disabled={isSending === testCampaign.id}
                    >
                      {isSending === testCampaign.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Test
                        </>
                      )}
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => handlePreview(testCampaign)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(testCampaign)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(testCampaign.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CampaignTesting;
