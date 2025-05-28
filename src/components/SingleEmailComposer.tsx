
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Sparkles, Upload, Eye, Send, Loader2, FileText, TestTube } from 'lucide-react';
import AISubjectGenerator from './AISubjectGenerator';
import TagPreviewTool from './TagPreviewTool';
import GoogleSheetsImport from './GoogleSheetsImport';
import EmailTemplateLibrary from './EmailTemplateLibrary';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useCampaigns } from '@/hooks/useCampaigns';
import { toast } from '@/hooks/use-toast';

interface SingleEmailComposerProps {
  organizationId?: string;
}

const SingleEmailComposer = ({ organizationId }: SingleEmailComposerProps) => {
  const { accounts } = useEmailAccounts(organizationId);
  const { createCampaign, sendCampaign } = useCampaigns(organizationId);
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  const [showPreview, setShowPreview] = useState(false);

  const [emailData, setEmailData] = useState({
    fromName: '',
    subject: '',
    recipients: '',
    htmlContent: '',
    textContent: '',
    sendMethod: 'smtp'
  });

  const activeAccounts = accounts.filter(account => account.is_active);
  const selectedMethodAccounts = activeAccounts.filter(account => account.type === emailData.sendMethod);

  const handleSend = async (isTest = false) => {
    if (!emailData.fromName || !emailData.subject || !emailData.recipients) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (selectedMethodAccounts.length === 0) {
      toast({
        title: "No Active Accounts",
        description: `Please add and activate at least one ${emailData.sendMethod.toUpperCase()} account`,
        variant: "destructive"
      });
      return;
    }

    const setSending = isTest ? setIsTestSending : setIsSending;
    setSending(true);
    
    try {
      const testRecipients = isTest ? emailData.recipients.split(',')[0].trim() : emailData.recipients;
      
      const campaign = await createCampaign({
        from_name: emailData.fromName,
        subject: isTest ? `[TEST] ${emailData.subject}` : emailData.subject,
        recipients: testRecipients,
        html_content: emailData.htmlContent,
        text_content: emailData.textContent,
        send_method: emailData.sendMethod,
        sent_at: new Date().toISOString()
      });

      if (campaign) {
        await sendCampaign(campaign.id);
        
        if (!isTest) {
          // Reset form only for actual sends, not tests
          setEmailData({
            fromName: '',
            subject: '',
            recipients: '',
            htmlContent: '',
            textContent: '',
            sendMethod: 'smtp'
          });
        }
        
        toast({
          title: isTest ? "Test Email Sent" : "Campaign Sent",
          description: isTest ? "Test email has been sent to the first recipient" : "Your email campaign has been sent successfully",
        });
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setEmailData(prev => ({
      ...prev,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent
    }));
    setActiveTab('compose');
    toast({
      title: "Template Applied",
      description: `"${template.name}" template has been loaded`,
    });
  };

  const insertTag = (tag: string) => {
    setEmailData(prev => ({
      ...prev,
      htmlContent: prev.htmlContent + tag
    }));
  };

  const handlePreview = () => {
    if (!emailData.subject || !emailData.htmlContent) {
      toast({
        title: "Missing Content",
        description: "Please add a subject and email content to preview",
        variant: "destructive"
      });
      return;
    }
    setShowPreview(true);
  };

  const processEmailContent = (content: string) => {
    // Replace common email tags with sample data for preview
    return content
      .replace(/\{\{(\[fromname\])\}\}/g, emailData.fromName || 'Your Name')
      .replace(/\{\{(\[to\])\}\}/g, 'recipient@example.com')
      .replace(/\{\{(\[subject\])\}\}/g, emailData.subject)
      .replace(/\{\{(\[rndn_10\])\}\}/g, Math.random().toString(36).substring(2, 12));
  };

  const recipientCount = emailData.recipients.split(',').filter(email => email.trim()).length;

  return (
    <div className="space-y-6">
      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Email Preview</h3>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
              <div className="border rounded-lg">
                <div className="bg-slate-50 p-4 border-b">
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>From:</strong> {emailData.fromName || 'Your Name'} &lt;{selectedMethodAccounts[0]?.email || 'sender@example.com'}&gt;</p>
                    <p><strong>To:</strong> {emailData.recipients.split(',')[0]?.trim() || 'recipient@example.com'}</p>
                    <p><strong>Subject:</strong> {emailData.subject}</p>
                  </div>
                </div>
                <div className="p-6">
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: processEmailContent(emailData.htmlContent || emailData.textContent || '<p>No content provided</p>')
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Compose Email
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Email Template Library</CardTitle>
              <CardDescription>
                Choose from our collection of professional email templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplateLibrary onSelectTemplate={handleTemplateSelect} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          {/* Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure your email settings and content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="Your Name or Company"
                    value={emailData.fromName}
                    onChange={(e) => setEmailData(prev => ({ ...prev, fromName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sendMethod">Send Method</Label>
                  <Select 
                    value={emailData.sendMethod} 
                    onValueChange={(value) => setEmailData(prev => ({ ...prev, sendMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sending method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP Server</SelectItem>
                      <SelectItem value="apps-script">Google Apps Script</SelectItem>
                      <SelectItem value="powermta">PowerMTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedMethodAccounts.length > 0 && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✓ {selectedMethodAccounts.length} active {emailData.sendMethod.toUpperCase()} account(s) available
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedMethodAccounts.map(account => (
                      <Badge key={account.id} variant="secondary" className="bg-green-100 text-green-800">
                        {account.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <div className="flex gap-2">
                  <Input
                    id="subject"
                    placeholder="Enter your email subject"
                    value={emailData.subject}
                    onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                    className="flex-1"
                  />
                  <AISubjectGenerator onSubjectSelect={(subject) => 
                    setEmailData(prev => ({ ...prev, subject }))
                  } />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipients">Recipients</Label>
                <Textarea
                  id="recipients"
                  placeholder="Enter email addresses separated by commas, or import from Google Sheets"
                  value={emailData.recipients}
                  onChange={(e) => setEmailData(prev => ({ ...prev, recipients: e.target.value }))}
                  rows={3}
                />
                <GoogleSheetsImport onImport={(emails) => 
                  setEmailData(prev => ({ ...prev, recipients: emails.join(', ') }))
                } />
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>
                Create your email content with dynamic tags and personalization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="html" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="html">HTML Content</TabsTrigger>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>HTML Email Body</Label>
                    <TagPreviewTool onTagInsert={insertTag} />
                  </div>
                  <Textarea
                    placeholder="Enter your HTML email content here. Use tags like {{[fromname]}}, {{[to]}}, etc."
                    value={emailData.htmlContent}
                    onChange={(e) => setEmailData(prev => ({ ...prev, htmlContent: e.target.value }))}
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Available tags:</Badge>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[fromname]}}')}>
                      {'{{[fromname]}}'}
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[to]}}')}>
                      {'{{[to]}}'}
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[subject]}}')}>
                      {'{{[subject]}}'}
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[rndn_10]}}')}>
                      {'{{[rndn_10]}}'}
                    </Badge>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <Label>Plain Text Email Body</Label>
                  <Textarea
                    placeholder="Enter the plain text version of your email"
                    value={emailData.textContent}
                    onChange={(e) => setEmailData(prev => ({ ...prev, textContent: e.target.value }))}
                    rows={15}
                  />
                </TabsContent>

                <TabsContent value="preview" className="space-y-4">
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="border-b pb-2 mb-4">
                      <p className="text-sm text-slate-600">From: {emailData.fromName || 'Your Name'}</p>
                      <p className="text-sm text-slate-600">Subject: {emailData.subject || 'Your Subject'}</p>
                    </div>
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: processEmailContent(emailData.htmlContent || '<p>Your email content will appear here...</p>')
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Send Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  Ready to send to {recipientCount} recipients
                  {selectedMethodAccounts.length === 0 && (
                    <span className="text-red-600 ml-2">(No active {emailData.sendMethod.toUpperCase()} accounts)</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => handleSend(true)}
                    disabled={isTestSending || selectedMethodAccounts.length === 0}
                  >
                    {isTestSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Send Test
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button 
                    onClick={() => handleSend(false)} 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={isSending || selectedMethodAccounts.length === 0}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Campaign
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SingleEmailComposer;
