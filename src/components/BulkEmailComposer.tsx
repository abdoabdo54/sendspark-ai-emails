
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Zap, Settings, AlertTriangle, Rocket, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import TestAfterSection from './TestAfterSection';
import { useNavigate } from 'react-router-dom';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  const { availableFunctions, sendCampaign } = useCampaignSender(currentOrganization?.id);
  
  // Form state
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Sending mode state
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  
  // Test-After state
  const [useTestAfter, setUseTestAfter] = useState(true);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(500);
  
  // Account selection state
  const [useAccountSelection, setUseAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [numAccountsToUse, setNumAccountsToUse] = useState(10);

  // Tracking state
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  // Subject and From rotation
  const [rotateSubjects, setRotateSubjects] = useState(false);
  const [subjectVariations, setSubjectVariations] = useState('');
  const [rotateFromNames, setRotateFromNames] = useState(false);
  const [fromNameVariations, setFromNameVariations] = useState('');

  const activeAccounts = accounts.filter(account => account.is_active);
  const recipientCount = recipients.split(',').filter(email => email.trim()).length;

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleCSVImport = (data: Array<{ [key: string]: any }>) => {
    const emails = data.map(row => {
      const emailField = Object.keys(row).find(key => 
        key.toLowerCase().includes('email') || key.toLowerCase() === 'e-mail'
      );
      return emailField ? row[emailField] : null;
    }).filter(email => email && email.trim());

    const emailList = emails.join(', ');
    setRecipients(emailList);
    toast({
      title: "Success",
      description: `Imported ${emails.length} email addresses`
    });
  };

  const handleGoogleSheetsImport = (data: string[]) => {
    const emailList = data.join(', ');
    setRecipients(emailList);
    toast({
      title: "Success", 
      description: `Imported ${data.length} email addresses from Google Sheets`
    });
  };

  const validateForm = () => {
    if (!fromName.trim()) {
      toast({
        title: "Validation Error",
        description: "From name is required",
        variant: "destructive"
      });
      return false;
    }

    if (!subject.trim()) {
      toast({
        title: "Validation Error", 
        description: "Subject is required",
        variant: "destructive"
      });
      return false;
    }

    if (!recipients.trim()) {
      toast({
        title: "Validation Error",
        description: "Recipients are required", 
        variant: "destructive"
      });
      return false;
    }

    if (!htmlContent.trim() && !textContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Email content is required",
        variant: "destructive"
      });
      return false;
    }

    if (activeAccounts.length === 0) {
      toast({
        title: "Validation Error",
        description: "No active email accounts found. Please add and activate at least one email account.",
        variant: "destructive"
      });
      return false;
    }

    if (useTestAfter && !testAfterEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Test-After email address is required when Test-After is enabled",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const config = {
      sendingMode,
      selectedAccounts: useAccountSelection ? selectedAccounts : [],
      numAccountsToUse,
      subjectRotation: {
        enabled: rotateSubjects,
        variations: rotateSubjects ? subjectVariations.split('\n').filter(s => s.trim()) : []
      },
      fromNameRotation: {
        enabled: rotateFromNames,
        variations: rotateFromNames ? fromNameVariations.split('\n').filter(s => s.trim()) : []
      },
      testAfter: {
        enabled: useTestAfter,
        email: testAfterEmail,
        count: testAfterCount
      },
      tracking: {
        enabled: trackingEnabled,
        trackOpens: trackingEnabled,
        trackClicks: trackingEnabled
      }
    };

    const campaignData = {
      from_name: fromName,
      subject,
      recipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'smtp',
      config
    };

    onSend(campaignData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Email Campaign Composer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Function Status */}
            <Alert className="border-blue-200 bg-blue-50">
              <Settings className="h-4 w-4" />
              <AlertDescription>
                <span className="text-blue-800">
                  <strong>{availableFunctions.length} Function(s)</strong> available for sending
                </span>
                <br />
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-800 underline"
                  onClick={() => navigate('/function-manager')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Manage Functions
                </Button>
              </AlertDescription>
            </Alert>

            {/* Sending Mode Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Sending Mode</Label>
              <RadioGroup 
                value={sendingMode} 
                onValueChange={(value: 'controlled' | 'fast' | 'zero-delay') => setSendingMode(value)}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="controlled" id="controlled" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <Label htmlFor="controlled" className="font-medium">Controlled Send</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Standard sending with rate limits
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="fast" id="fast" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <Label htmlFor="fast" className="font-medium">Fast Send</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      High-speed sending
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="zero-delay" id="zero-delay" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-red-600" />
                      <Label htmlFor="zero-delay" className="font-medium">Maximum Speed</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      No delays between sends
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Basic Campaign Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromName">From Name *</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email Subject"
                  required
                />
              </div>
            </div>

            <AISubjectGenerator onSubjectSelect={setSubject} />

            {/* Recipients */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="recipients">Recipients *</Label>
                <Badge variant="secondary">
                  {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Textarea
                id="recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com, ..."
                rows={4}
                required
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CSVDataImporter onImport={handleCSVImport} />
                <GoogleSheetsImport onImport={handleGoogleSheetsImport} />
              </div>
            </div>

            {/* Email Content */}
            <div className="space-y-4">
              <Label htmlFor="htmlContent">HTML Content *</Label>
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<h1>Your HTML content here...</h1>"
                rows={6}
                required
              />
            </div>

            <div className="space-y-4">
              <Label htmlFor="textContent">Plain Text Content</Label>
              <Textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Your plain text content here..."
                rows={4}
              />
            </div>

            <Separator />

            {/* Test-After Configuration */}
            <TestAfterSection
              useTestAfter={useTestAfter}
              onUseTestAfterChange={setUseTestAfter}
              testAfterEmail={testAfterEmail}
              onTestAfterEmailChange={setTestAfterEmail}
              testAfterCount={testAfterCount}
              onTestAfterCountChange={setTestAfterCount}
            />

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={accountsLoading}
            >
              <Zap className="w-4 h-4 mr-2" />
              Send Campaign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
