
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Rocket, ExternalLink, Calculator, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useNavigate } from 'react-router-dom';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import CompactAccountSelector from './CompactAccountSelector';
import AdvancedConfigurationPanel from './AdvancedConfigurationPanel';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { functions, hasFunctions, sendCampaign } = useCampaignSender(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  
  // Form state
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Account selection state
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Configuration states
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  const [useTestAfter, setUseTestAfter] = useState(true);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(500);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);

  // SmartConfig state
  const [smartConfig, setSmartConfig] = useState<any>(null);
  const [estimatedTime, setEstimatedTime] = useState('');

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;
  const activeAccounts = accounts.filter(account => account.is_active);
  const hasAccounts = selectedAccounts.length > 0;

  // Auto-select all accounts when they load
  useEffect(() => {
    if (activeAccounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(activeAccounts.map(account => account.id));
    }
  }, [activeAccounts]);

  // Load SmartConfig on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('smartConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setSmartConfig(config);
      }
    } catch (error) {
      console.error('Error loading smart config:', error);
    }
  }, []);

  // Calculate estimated time
  useEffect(() => {
    if (recipientCount > 0 && functions.length > 0) {
      const emailsPerFunction = Math.ceil(recipientCount / functions.length);
      let estimatedSeconds;
      
      switch (sendingMode) {
        case 'zero-delay':
          estimatedSeconds = Math.ceil(emailsPerFunction / 1000);
          break;
        case 'fast':
          estimatedSeconds = Math.ceil(emailsPerFunction / 200);
          break;
        default:
          estimatedSeconds = Math.ceil(emailsPerFunction / 50);
      }
      
      setEstimatedTime(`~${estimatedSeconds} seconds`);
    } else {
      setEstimatedTime('');
    }
  }, [recipientCount, functions.length, sendingMode]);

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

  const handleSelectAllAccounts = () => {
    setSelectedAccounts(activeAccounts.map(account => account.id));
  };

  const handleDeselectAllAccounts = () => {
    setSelectedAccounts([]);
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

    if (!hasFunctions) {
      toast({
        title: "Validation Error",
        description: "No Cloud Functions available. Please add functions in Function Manager.",
        variant: "destructive"
      });
      return false;
    }

    if (!hasAccounts) {
      toast({
        title: "Validation Error",
        description: "Please select at least one email account.",
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
      selectedAccounts,
      testAfter: {
        enabled: useTestAfter,
        email: testAfterEmail,
        count: testAfterCount
      },
      tracking: {
        enabled: trackingEnabled,
        trackOpens: trackingEnabled,
        trackClicks: trackingEnabled
      },
      rotation: {
        fromName: useFromRotation,
        subject: useSubjectRotation
      },
      smartConfig
    };

    const campaignData = {
      from_name: fromName,
      subject,
      recipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'parallel_gcf',
      config
    };

    try {
      console.log('🚀 Starting campaign with parallel dispatch...');
      const result = await sendCampaign(campaignData);
      
      toast({
        title: "✅ Campaign Dispatched",
        description: `Campaign sent to ${result.totalSlices} Cloud Functions in parallel`
      });

      onSend(campaignData);
    } catch (error: any) {
      console.error('Campaign failed:', error);
      toast({
        title: "❌ Campaign Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5" />
            Advanced Parallel Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Navigation */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/function-manager')}
                type="button"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Functions ({functions.length})
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/settings')}
                type="button"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Accounts ({activeAccounts.length})
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/smart-config')}
                type="button"
              >
                <Calculator className="w-3 h-3 mr-1" />
                SmartConfig
              </Button>
            </div>

            {/* SmartConfig Status */}
            {smartConfig && (
              <Alert className="border-blue-200 bg-blue-50">
                <Calculator className="h-4 w-4" />
                <AlertDescription>
                  <div className="text-blue-800 text-sm">
                    <strong>SmartConfig Active:</strong> Optimized for {smartConfig.emailVolume?.toLocaleString()} emails
                    <br />
                    <span className="text-xs">
                      Recommended: {smartConfig.recommendedFunctions} functions, {smartConfig.recommendedAccounts} accounts
                      • Est. time: {smartConfig.estimatedTime}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Account Selection */}
            <CompactAccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={setSelectedAccounts}
              onSelectAll={handleSelectAllAccounts}
              onDeselectAll={handleDeselectAllAccounts}
            />

            {/* Basic Campaign Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromName" className="text-sm">From Name *</Label>
                    <Input
                      id="fromName"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Your Name"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject" className="text-sm">Subject *</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email Subject"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <AISubjectGenerator onSubjectSelect={setSubject} />

                {/* Recipients */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="recipients" className="text-sm">Recipients *</Label>
                    <Badge variant="secondary" className="text-xs">
                      {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Textarea
                    id="recipients"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="email1@example.com, email2@example.com, ..."
                    rows={3}
                    className="text-sm"
                    required
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <CSVDataImporter onImport={handleCSVImport} />
                    <GoogleSheetsImport onImport={handleGoogleSheetsImport} />
                  </div>
                </div>

                {/* Email Content */}
                <div className="space-y-3">
                  <Label htmlFor="htmlContent" className="text-sm">HTML Content *</Label>
                  <Textarea
                    id="htmlContent"
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="<h1>Your HTML content here...</h1>"
                    rows={5}
                    className="text-sm font-mono"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="textContent" className="text-sm">Plain Text Content</Label>
                  <Textarea
                    id="textContent"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Your plain text content here..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Advanced Configuration */}
            <AdvancedConfigurationPanel
              sendingMode={sendingMode}
              onSendingModeChange={setSendingMode}
              useTestAfter={useTestAfter}
              onUseTestAfterChange={setUseTestAfter}
              testAfterEmail={testAfterEmail}
              onTestAfterEmailChange={setTestAfterEmail}
              testAfterCount={testAfterCount}
              onTestAfterCountChange={setTestAfterCount}
              trackingEnabled={trackingEnabled}
              onTrackingEnabledChange={setTrackingEnabled}
              useFromRotation={useFromRotation}
              onUseFromRotationChange={setUseFromRotation}
              useSubjectRotation={useSubjectRotation}
              onUseSubjectRotationChange={setUseSubjectRotation}
              hasAccounts={hasAccounts}
              hasFunctions={hasFunctions}
              estimatedTime={estimatedTime}
            />

            <Separator />

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={!hasFunctions || !hasAccounts}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Launch Parallel Campaign
              {estimatedTime && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {estimatedTime}
                </Badge>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
