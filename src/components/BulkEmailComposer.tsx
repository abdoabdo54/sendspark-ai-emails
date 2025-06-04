import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Upload, Users, Mail, Send, Eye, Save, Settings, AlertCircle, Shuffle, RotateCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import EmailTemplateLibrary from './EmailTemplateLibrary';
import TagPreviewTool from './TagPreviewTool';
import AISubjectGenerator from './AISubjectGenerator';

interface BulkEmailComposerProps {
  organizationId: string;
}

interface RecipientData {
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

interface RotationConfig {
  fromNames: string[];
  subjects: string[];
  useRotation: boolean;
}

const BulkEmailComposer = ({ organizationId }: BulkEmailComposerProps) => {
  const { createCampaign } = useCampaigns(organizationId);
  const { accounts } = useEmailAccounts(organizationId);
  
  // Persistent state for recipients
  const [recipients, setRecipients] = useState<RecipientData[]>([]);
  const [manualEmails, setManualEmails] = useState('');
  
  // Campaign configuration
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Rotation settings
  const [rotationConfig, setRotationConfig] = useState<RotationConfig>({
    fromNames: [''],
    subjects: [''],
    useRotation: false
  });
  
  // Sender selection
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sendingMethod, setSendingMethod] = useState<'single' | 'multiple' | 'round-robin'>('single');
  
  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState<RecipientData | null>(null);

  const activeAccounts = accounts.filter(acc => acc.is_active);

  // Generate random values for tags
  const generateRandomValue = (type: string, length: number): string => {
    const chars = {
      'n': '0123456789',
      'a': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      'l': 'abcdefghijklmnopqrstuvwxyz',
      'u': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      's': '*-_#!@$%&',
      'lu': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      'ln': 'abcdefghijklmnopqrstuvwxyz0123456789',
      'un': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    };
    
    const charset = chars[type] || chars['a'];
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  };

  // Process tags in content
  const processTags = (content: string, recipient: RecipientData, accountData?: any): string => {
    let processed = content;
    
    // Basic tags
    processed = processed.replace(/\[from\]/g, rotationConfig.useRotation 
      ? rotationConfig.fromNames[Math.floor(Math.random() * rotationConfig.fromNames.length)]
      : fromName);
    processed = processed.replace(/\[subject\]/g, rotationConfig.useRotation 
      ? rotationConfig.subjects[Math.floor(Math.random() * rotationConfig.subjects.length)]
      : subject);
    processed = processed.replace(/\[to\]/g, recipient.email);
    
    // SMTP tags
    if (accountData && accountData.type === 'smtp') {
      processed = processed.replace(/\[smtp\]/g, accountData.config?.username || '');
      processed = processed.replace(/\[smtp_name\]/g, accountData.name || '');
    }
    
    // Random tags with all variations
    const randomTagPatterns = [
      { pattern: /\[rndn_(\d+)\]/g, type: 'n' },
      { pattern: /\[rnda_(\d+)\]/g, type: 'a' },
      { pattern: /\[rndl_(\d+)\]/g, type: 'l' },
      { pattern: /\[rndu_(\d+)\]/g, type: 'u' },
      { pattern: /\[rnds_(\d+)\]/g, type: 's' },
      { pattern: /\[rndlu_(\d+)\]/g, type: 'lu' },
      { pattern: /\[rndln_(\d+)\]/g, type: 'ln' },
      { pattern: /\[rndun_(\d+)\]/g, type: 'un' }
    ];

    randomTagPatterns.forEach(({ pattern, type }) => {
      processed = processed.replace(pattern, (match, length) => {
        return generateRandomValue(type, parseInt(length));
      });
    });
    
    // Legacy tags
    processed = processed.replace(/\{\{firstName\}\}/g, recipient.firstName || '');
    processed = processed.replace(/\{\{lastName\}\}/g, recipient.lastName || '');
    processed = processed.replace(/\{\{email\}\}/g, recipient.email);
    
    return processed;
  };

  // Persist recipients when they're added manually
  useEffect(() => {
    if (manualEmails.trim()) {
      const emails = manualEmails.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes('@'))
        .map(email => ({ email: email.trim() }));
      
      // Merge with existing recipients, avoiding duplicates
      const existingEmails = new Set(recipients.map(r => r.email));
      const newRecipients = emails.filter(r => !existingEmails.has(r.email));
      
      if (newRecipients.length > 0) {
        setRecipients(prev => [...prev, ...newRecipients]);
      }
    }
  }, [manualEmails]);

  const handleCSVImport = (data: RecipientData[]) => {
    // Merge with existing recipients
    const existingEmails = new Set(recipients.map(r => r.email));
    const newRecipients = data.filter(r => !existingEmails.has(r.email));
    setRecipients(prev => [...prev, ...newRecipients]);
    toast({
      title: "CSV Imported",
      description: `Successfully imported ${newRecipients.length} new recipients`
    });
  };

  const handleGoogleSheetsImport = (data: string[]) => {
    const recipientData = data.map(email => ({ email: email.trim() }));
    const existingEmails = new Set(recipients.map(r => r.email));
    const newRecipients = recipientData.filter(r => !existingEmails.has(r.email));
    setRecipients(prev => [...prev, ...newRecipients]);
    toast({
      title: "Google Sheets Imported",
      description: `Successfully imported ${newRecipients.length} new recipients`
    });
  };

  const handleTemplateSelect = (template: any) => {
    setSubject(template.subject || '');
    setHtmlContent(template.htmlContent || '');
    setTextContent(template.textContent || '');
    toast({
      title: "Template Applied",
      description: `Template "${template.name}" has been applied`
    });
  };

  const handleAccountSelection = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts(prev => [...prev, accountId]);
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
    }
  };

  const addRotationItem = (type: 'fromNames' | 'subjects') => {
    setRotationConfig(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }));
  };

  const updateRotationItem = (type: 'fromNames' | 'subjects', index: number, value: string) => {
    setRotationConfig(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? value : item)
    }));
  };

  const removeRotationItem = (type: 'fromNames' | 'subjects', index: number) => {
    setRotationConfig(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handlePreview = () => {
    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add recipients to preview the email",
        variant: "destructive"
      });
      return;
    }

    const recipient = recipients[0];
    const selectedAccount = accounts.find(acc => acc.id === selectedAccounts[0]);
    
    // Create preview content with personalization
    let previewHtml = processTags(htmlContent, recipient, selectedAccount);
    let previewSubject = processTags(subject, recipient, selectedAccount);

    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Email Preview - ${previewSubject}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .content { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .tag-info { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 10px 0; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>📧 Email Preview</h2>
              <p><strong>Subject:</strong> ${previewSubject}</p>
              <p><strong>From:</strong> ${rotationConfig.useRotation ? '[Rotating]' : fromName}</p>
              <p><strong>To:</strong> ${recipient.email}</p>
              <p><strong>Recipients:</strong> ${recipients.length} total</p>
              ${selectedAccount ? `<p><strong>Sender:</strong> ${selectedAccount.name} (${selectedAccount.type})</p>` : ''}
              <div class="tag-info">
                <strong>Available Tags:</strong> [from], [subject], [to], [smtp], [smtp_name], [rndn_N], [rnda_N], [rndl_N], [rndu_N], [rnds_N], [rndlu_N], [rndln_N], [rndun_N]
              </div>
            </div>
            <div class="content">
              ${previewHtml}
            </div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  const handleCreateCampaign = async () => {
    if (!fromName.trim() || !subject.trim() || !htmlContent.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add at least one recipient",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "No Sender Selected",
        description: "Please select at least one email account",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      // Determine send method based on selected accounts
      let sendMethod = 'smtp'; // default
      const selectedAccount = accounts.find(acc => acc.id === selectedAccounts[0]);
      if (selectedAccount) {
        sendMethod = selectedAccount.type;
      }

      const recipientEmails = recipients.map(r => r.email).join(',');

      // Create enhanced campaign with rotation config
      const campaignData = {
        from_name: fromName,
        subject: subject,
        recipients: recipientEmails,
        html_content: htmlContent,
        text_content: textContent,
        send_method: sendMethod,
        config: {
          rotation: rotationConfig,
          selectedAccounts: selectedAccounts,
          sendingMethod: sendingMethod,
          recipientData: recipients
        }
      };

      await createCampaign(campaignData);

      // Reset form but keep recipients for reuse
      setFromName('');
      setSubject('');
      setHtmlContent('');
      setTextContent('');
      setCurrentStep(1);

      toast({
        title: "Campaign Created",
        description: `Campaign created successfully with ${recipients.length} recipients and tracking enabled`
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return recipients.length > 0;
      case 3:
        return recipients.length > 0 && fromName.trim() && subject.trim();
      case 4:
        return recipients.length > 0 && fromName.trim() && subject.trim() && htmlContent.trim();
      default:
        return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {step}
              </div>
              {step < 4 && <div className={`w-16 h-0.5 ${currentStep > step ? 'bg-blue-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
        <div className="text-sm text-slate-600">
          Step {currentStep} of 4
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Step 1: Add Recipients
            </CardTitle>
            <CardDescription>
              Import your recipient list from various sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-emails">Email Addresses (one per line)</Label>
                  <Textarea
                    id="manual-emails"
                    placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                    className="min-h-[200px]"
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                  />
                  <p className="text-sm text-slate-500">
                    Enter one email address per line. Recipients will be automatically added as you type.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="csv">
                <CSVDataImporter onImport={handleCSVImport} />
              </TabsContent>

              <TabsContent value="sheets">
                <GoogleSheetsImport onImport={handleGoogleSheetsImport} />
              </TabsContent>
            </Tabs>

            {recipients.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {recipients.length} Recipients Added
                  </span>
                </div>
                <div className="text-sm text-blue-700">
                  Recipients: {recipients.slice(0, 3).map(r => r.email).join(', ')}
                  {recipients.length > 3 && ` and ${recipients.length - 3} more...`}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setCurrentStep(2)} 
                disabled={recipients.length === 0}
              >
                Next: Sender Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Step 2: Configure Sending Settings
            </CardTitle>
            <CardDescription>
              Choose your email accounts and sending strategy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Select Email Accounts</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Choose one or more email accounts to send your campaign
                </p>
                
                {activeAccounts.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800">
                      No active email accounts found. Please configure email accounts first.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAccounts.map((account) => (
                      <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={account.id}
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={(checked) => handleAccountSelection(account.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={account.id} className="font-medium cursor-pointer">
                              {account.name}
                            </Label>
                            <Badge variant="outline">{account.type.toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm text-slate-500">{account.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedAccounts.length > 1 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Sending Strategy</Label>
                  <Select value={sendingMethod} onValueChange={(value: 'single' | 'multiple' | 'round-robin') => setSendingMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Use first selected account</SelectItem>
                      <SelectItem value="multiple">Send from all selected accounts</SelectItem>
                      <SelectItem value="round-robin">Round-robin distribution</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-500">
                    {sendingMethod === 'single' && 'All emails will be sent from the first selected account'}
                    {sendingMethod === 'multiple' && 'Campaign will be duplicated for each selected account'}
                    {sendingMethod === 'round-robin' && 'Recipients will be distributed evenly across selected accounts'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} 
                disabled={selectedAccounts.length === 0}
              >
                Next: Email Content
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Step 3: Email Content & Rotation
            </CardTitle>
            <CardDescription>
              Create your email content with advanced rotation options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rotation Toggle */}
            <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <Checkbox
                id="use-rotation"
                checked={rotationConfig.useRotation}
                onCheckedChange={(checked) => setRotationConfig(prev => ({ ...prev, useRotation: checked as boolean }))}
              />
              <Label htmlFor="use-rotation" className="font-medium flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Enable Rotation for From Names & Subjects
              </Label>
            </div>

            {/* From Name Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">From Name Configuration</Label>
              {rotationConfig.useRotation ? (
                <div className="space-y-3">
                  {rotationConfig.fromNames.map((name, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`From Name ${index + 1}`}
                        value={name}
                        onChange={(e) => updateRotationItem('fromNames', index, e.target.value)}
                        className="flex-1"
                      />
                      {rotationConfig.fromNames.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRotationItem('fromNames', index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addRotationItem('fromNames')}
                    className="w-full"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Add Another From Name
                  </Button>
                </div>
              ) : (
                <Input
                  placeholder="Your Name or Company"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              )}
            </div>

            {/* Subject Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Subject Line Configuration</Label>
              {rotationConfig.useRotation ? (
                <div className="space-y-3">
                  {rotationConfig.subjects.map((subj, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Subject Line ${index + 1}`}
                        value={subj}
                        onChange={(e) => updateRotationItem('subjects', index, e.target.value)}
                        className="flex-1"
                      />
                      {rotationConfig.subjects.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRotationItem('subjects', index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addRotationItem('subjects')}
                    className="w-full"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Add Another Subject
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Your compelling subject line"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1"
                  />
                  <AISubjectGenerator onGenerated={setSubject} />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Email Templates</Label>
                <EmailTemplateLibrary onSelectTemplate={handleTemplateSelect} />
              </div>
              
              {/* Tag Information */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-2">Available Tags:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <code>[from]</code> <span className="text-slate-600">From Name</span>
                  <code>[subject]</code> <span className="text-slate-600">Subject</span>
                  <code>[to]</code> <span className="text-slate-600">Recipient Email</span>
                  <code>[smtp]</code> <span className="text-slate-600">SMTP Username</span>
                  <code>[smtp_name]</code> <span className="text-slate-600">SMTP Name</span>
                  <code>[rndn_N]</code> <span className="text-slate-600">Random Numbers</span>
                  <code>[rnda_N]</code> <span className="text-slate-600">Random Alphanumeric</span>
                  <code>[rndl_N]</code> <span className="text-slate-600">Random Lowercase</span>
                  <code>[rndu_N]</code> <span className="text-slate-600">Random Uppercase</span>
                  <code>[rnds_N]</code> <span className="text-slate-600">Random Symbols</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Replace N with desired length (e.g., [rndn_5] for 5 random numbers)</p>
              </div>
              
              <Tabs defaultValue="html" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="html">HTML Content</TabsTrigger>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="preview">Preview & Tags</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-2">
                  <Label htmlFor="html-content">HTML Content *</Label>
                  <Textarea
                    id="html-content"
                    placeholder="<h1>Hello [to]!</h1><p>Your email content here... Use [from], [subject], [rndn_5] etc.</p>"
                    className="min-h-[300px] font-mono"
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="text" className="space-y-2">
                  <Label htmlFor="text-content">Plain Text Content</Label>
                  <Textarea
                    id="text-content"
                    placeholder="Hello [to]! Your email content in plain text..."
                    className="min-h-[300px]"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="preview">
                  <TagPreviewTool
                    onTagInsert={(tag) => {
                      setHtmlContent(prev => prev + tag);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(4)} 
                disabled={!htmlContent.trim() || (!rotationConfig.useRotation && (!fromName.trim() || !subject.trim()))}
              >
                Next: Review & Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Step 4: Review & Send
            </CardTitle>
            <CardDescription>
              Review your campaign settings and send with tracking enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Campaign Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">From Name:</span>
                    <span className="font-medium">
                      {rotationConfig.useRotation ? `${rotationConfig.fromNames.length} variants` : fromName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subject:</span>
                    <span className="font-medium">
                      {rotationConfig.useRotation ? `${rotationConfig.subjects.length} variants` : subject}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Recipients:</span>
                    <span className="font-medium">{recipients.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Selected Accounts:</span>
                    <span className="font-medium">{selectedAccounts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sending Method:</span>
                    <span className="font-medium">{sendingMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tracking:</span>
                    <span className="font-medium text-green-600">✓ Enabled (Opens, Clicks, Unsubscribes)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Email with Tags
                  </Button>
                  <Button 
                    className="w-full" 
                    onClick={handleCreateCampaign}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating Campaign...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Create Campaign with Tracking
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkEmailComposer;
