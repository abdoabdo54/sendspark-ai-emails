
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
import { Clock, Zap, Settings, AlertTriangle, Rocket, ExternalLink, Calculator } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import TestAfterSection from './TestAfterSection';
import AccountSelector from './AccountSelector';
import { useNavigate } from 'react-router-dom';

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
  
  // Sending mode state
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  
  // Test-After state
  const [useTestAfter, setUseTestAfter] = useState(true);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(500);
  
  // Tracking state
  const [trackingEnabled, setTrackingEnabled] = useState(false);

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
      const estimatedSeconds = sendingMode === 'zero-delay' 
        ? Math.ceil(emailsPerFunction / 1000) 
        : Math.ceil(emailsPerFunction / 200);
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Parallel Email Campaign Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Navigation Links */}
            <div className="flex gap-2 mb-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/function-manager')}
                type="button"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Function Manager
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/settings')}
                type="button"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Email Accounts
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/smart-config')}
                type="button"
              >
                <Calculator className="w-4 h-4 mr-1" />
                SmartConfig
              </Button>
            </div>

            {/* SmartConfig Integration */}
            {smartConfig && (
              <Alert className="border-blue-200 bg-blue-50">
                <Calculator className="h-4 w-4" />
                <AlertDescription>
                  <div className="text-blue-800">
                    <strong>SmartConfig Active:</strong> Optimized for {smartConfig.emailVolume?.toLocaleString()} emails
                    <br />
                    <span className="text-sm">
                      Recommended: {smartConfig.recommendedFunctions} functions, {smartConfig.recommendedAccounts} accounts
                      • Est. time: {smartConfig.estimatedTime}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Resource Status */}
            <Alert className={hasFunctions && hasAccounts ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                {hasFunctions && hasAccounts ? (
                  <span className="text-green-800">
                    <strong>✅ Ready:</strong> {functions.length} functions, {selectedAccounts.length} accounts selected
                    {estimatedTime && ` • ${estimatedTime} estimated`}
                  </span>
                ) : (
                  <div className="text-yellow-800">
                    <strong>⚠️ Setup Required:</strong>
                    {!hasFunctions && " Add Cloud Functions"}
                    {!hasFunctions && !hasAccounts && " • "}
                    {!hasAccounts && " Select Email Accounts"}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {/* Account Selection */}
            <AccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={setSelectedAccounts}
              onSelectAll={handleSelectAllAccounts}
              onDeselectAll={handleDeselectAllAccounts}
            />

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
                      Standard rate limits
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="fast" id="fast" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <Label htmlFor="fast" className="font-medium">Fast Parallel</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      High-speed parallel dispatch
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="zero-delay" id="zero-delay" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-red-600" />
                      <Label htmlFor="zero-delay" className="font-medium">Zero Delay</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Maximum speed
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {sendingMode === 'zero-delay' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Zero Delay Mode:</strong> Maximum speed parallel dispatch across all functions.
                  </AlertDescription>
                </Alert>
              )}
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

            {/* Tracking Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Tracking</Label>
                  <p className="text-sm text-gray-600">
                    Track email opens and link clicks
                  </p>
                </div>
                <Switch
                  checked={trackingEnabled}
                  onCheckedChange={setTrackingEnabled}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={!hasFunctions || !hasAccounts}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Launch Parallel Campaign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
