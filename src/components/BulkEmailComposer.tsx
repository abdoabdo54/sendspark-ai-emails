import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Rocket, ExternalLink, Calculator, Mail, Eye, Zap, Clock, RotateCcw, Target, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useNavigate } from 'react-router-dom';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import CompactAccountSelector from './CompactAccountSelector';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { functions, hasFunctions } = useCampaignSender(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  
  // Form state
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Account selection state
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Sending configuration
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  const [dispatchMethod, setDispatchMethod] = useState<'parallel' | 'round-robin' | 'sequential'>('parallel');
  
  // Rotation configuration
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [fromNameVariations, setFromNameVariations] = useState('');
  const [subjectVariations, setSubjectVariations] = useState('');
  
  // Test-After configuration
  const [useTestAfter, setUseTestAfter] = useState(true);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(500);
  
  // Other configuration
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false);

  // SmartConfig state - upgraded to be dynamic
  const [smartConfig, setSmartConfig] = useState<any>(null);
  const [useCustomConfig, setUseCustomConfig] = useState(false);
  const [customFunctionCount, setCustomFunctionCount] = useState<number>(1);
  const [customAccountCount, setCustomAccountCount] = useState<number>(1);
  const [estimatedTime, setEstimatedTime] = useState('');

  // Prevent double submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;
  const activeAccounts = accounts.filter(account => account.is_active);
  const hasAccounts = selectedAccounts.length > 0;

  // Auto-select all accounts when they load
  useEffect(() => {
    if (activeAccounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(activeAccounts.map(account => account.id));
    }
  }, [activeAccounts]);

  // Initialize custom config with available resources
  useEffect(() => {
    if (functions.length > 0 && customFunctionCount === 1) {
      setCustomFunctionCount(Math.min(functions.length, 3)); // Default to 3 or max available
    }
    if (selectedAccounts.length > 0 && customAccountCount === 1) {
      setCustomAccountCount(Math.min(selectedAccounts.length, 2)); // Default to 2 or max selected
    }
  }, [functions.length, selectedAccounts.length]);

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

  // Dynamic estimation calculation - UPGRADED
  useEffect(() => {
    if (recipientCount > 0) {
      const functionsToUse = useCustomConfig ? customFunctionCount : functions.length;
      const accountsToUse = useCustomConfig ? customAccountCount : selectedAccounts.length;
      
      if (functionsToUse > 0) {
        const emailsPerFunction = Math.ceil(recipientCount / functionsToUse);
        let estimatedSeconds;
        let throughputPerSecond;
        
        switch (sendingMode) {
          case 'zero-delay':
            throughputPerSecond = 1000; // Very fast
            estimatedSeconds = Math.ceil(emailsPerFunction / throughputPerSecond);
            break;
          case 'fast':
            throughputPerSecond = 200; // Fast
            estimatedSeconds = Math.ceil(emailsPerFunction / throughputPerSecond);
            break;
          default:
            throughputPerSecond = 50; // Controlled
            estimatedSeconds = Math.ceil(emailsPerFunction / throughputPerSecond);
        }
        
        // Format time nicely
        let timeDisplay;
        if (estimatedSeconds < 60) {
          timeDisplay = `${estimatedSeconds}s`;
        } else if (estimatedSeconds < 3600) {
          timeDisplay = `${Math.ceil(estimatedSeconds / 60)}m`;
        } else {
          timeDisplay = `${Math.ceil(estimatedSeconds / 3600)}h`;
        }
        
        setEstimatedTime(`~${timeDisplay} (${functionsToUse} functions, ${accountsToUse} accounts, ${emailsPerFunction} emails/function)`);
      } else {
        setEstimatedTime('');
      }
    } else {
      setEstimatedTime('');
    }
  }, [recipientCount, functions.length, selectedAccounts.length, sendingMode, useCustomConfig, customFunctionCount, customAccountCount]);

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
    console.log('BulkEmailComposer: handleDeselectAllAccounts called');
    setSelectedAccounts([]);
  };

  const validateForm = () => {
    if (!fromName.trim() && !useFromRotation) {
      toast({
        title: "Validation Error",
        description: "From name is required or enable rotation with variations",
        variant: "destructive"
      });
      return false;
    }

    if (!subject.trim() && !useSubjectRotation) {
      toast({
        title: "Validation Error", 
        description: "Subject is required or enable rotation with variations",
        variant: "destructive"
      });
      return false;
    }

    if (useFromRotation && !fromNameVariations.trim()) {
      toast({
        title: "Validation Error",
        description: "From name variations are required when rotation is enabled",
        variant: "destructive"
      });
      return false;
    }

    if (useSubjectRotation && !subjectVariations.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject variations are required when rotation is enabled",
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

    if (useCustomConfig && (customFunctionCount <= 0 || customAccountCount <= 0)) {
      toast({
        title: "Validation Error",
        description: "Custom function and account counts must be greater than 0",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      console.log('Already submitting, preventing duplicate');
      return;
    }
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Prepare recipients list with test-after emails included if enabled
      let finalRecipients = recipients.split(',').map(email => email.trim()).filter(email => email);
      
      // Add test-after emails if enabled - OLD WAY AS REQUESTED
      if (useTestAfter && testAfterEmail.trim()) {
        const testEmail = testAfterEmail.trim();
        const newRecipientsList = [];
        
        for (let i = 0; i < finalRecipients.length; i++) {
          newRecipientsList.push(finalRecipients[i]);
          
          // Add test email every testAfterCount emails
          if ((i + 1) % testAfterCount === 0) {
            newRecipientsList.push(testEmail);
          }
        }
        
        // If we didn't add a test email at the end and there are recipients
        if (finalRecipients.length % testAfterCount !== 0 && finalRecipients.length > 0) {
          newRecipientsList.push(testEmail);
        }
        
        finalRecipients = newRecipientsList;
        console.log(`Test-After: Injected ${Math.ceil(finalRecipients.length / (testAfterCount + 1))} test emails`);
      }

      const config = {
        sendingMode,
        dispatchMethod,
        selectedAccounts,
        useCustomConfig,
        customFunctionCount: useCustomConfig ? customFunctionCount : functions.length,
        customAccountCount: useCustomConfig ? customAccountCount : selectedAccounts.length,
        rotation: {
          useFromNameRotation: useFromRotation,
          useSubjectRotation: useSubjectRotation,
          fromNames: useFromRotation ? fromNameVariations.split(',').map(s => s.trim()) : [],
          subjects: useSubjectRotation ? subjectVariations.split(',').map(s => s.trim()) : []
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
        },
        smartConfig
      };

      const campaignData = {
        from_name: useFromRotation ? fromNameVariations.split(',')[0].trim() : fromName,
        subject: useSubjectRotation ? subjectVariations.split(',')[0].trim() : subject,
        recipients: finalRecipients.join(', '),
        html_content: htmlContent,
        text_content: textContent,
        send_method: 'parallel_gcf',
        config
      };

      console.log('📝 Creating campaign (draft status) with data:', campaignData);
      
      // Call onSend which should now only CREATE the campaign as draft
      await onSend(campaignData);
      
      toast({
        title: "✅ Campaign Created",
        description: `Campaign created successfully with ${finalRecipients.length} recipients. Go to Campaign History to prepare and send.`
      });

      // Clear form after successful creation
      setFromName('');
      setSubject('');
      setRecipients('');
      setHtmlContent('');
      setTextContent('');
      setFromNameVariations('');
      setSubjectVariations('');
      setTestAfterEmail('');

    } catch (error: any) {
      console.error('Campaign creation failed:', error);
      toast({
        title: "❌ Campaign Creation Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5" />
            Create Email Campaign
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

            {/* Enhanced SmartConfig - UPGRADED */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Smart Configuration Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useCustomConfig">Use Manual Configuration</Label>
                  <Switch
                    id="useCustomConfig"
                    checked={useCustomConfig}
                    onCheckedChange={setUseCustomConfig}
                  />
                </div>
                
                {useCustomConfig && (
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customFunctionCount">Number of Functions to Use</Label>
                        <Input
                          id="customFunctionCount"
                          type="number"
                          min="1"
                          max={functions.length}
                          value={customFunctionCount}
                          onChange={(e) => setCustomFunctionCount(parseInt(e.target.value) || 1)}
                          placeholder={`Max: ${functions.length}`}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Available: {functions.length} functions
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="customAccountCount">Number of Accounts to Use</Label>
                        <Input
                          id="customAccountCount"
                          type="number"
                          min="1"
                          max={selectedAccounts.length || 1}
                          value={customAccountCount}
                          onChange={(e) => setCustomAccountCount(parseInt(e.target.value) || 1)}
                          placeholder={`Max: ${selectedAccounts.length}`}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Selected: {selectedAccounts.length} accounts
                        </p>
                      </div>
                    </div>
                    
                    {estimatedTime && (
                      <Alert className="border-green-200 bg-green-50">
                        <Zap className="h-4 w-4" />
                        <AlertDescription className="text-green-800 text-sm">
                          <strong>Estimated Performance:</strong> {estimatedTime}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {smartConfig && !useCustomConfig && (
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
              </CardContent>
            </Card>

            {/* Sending Mode & Dispatch Method */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Sending Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Sending Mode</Label>
                    <RadioGroup 
                      value={sendingMode} 
                      onValueChange={(value: 'controlled' | 'fast' | 'zero-delay') => setSendingMode(value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="controlled" id="controlled" />
                        <Label htmlFor="controlled" className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3" />
                          Controlled (2s delay)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fast" id="fast" />
                        <Label htmlFor="fast" className="flex items-center gap-1 text-sm">
                          <Zap className="w-3 h-3" />
                          Fast (0.5s delay)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="zero-delay" id="zero-delay" />
                        <Label htmlFor="zero-delay" className="flex items-center gap-1 text-sm">
                          <Rocket className="w-3 h-3" />
                          Zero Delay (Max Speed)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Dispatch Method</Label>
                    <RadioGroup 
                      value={dispatchMethod} 
                      onValueChange={(value: 'parallel' | 'round-robin' | 'sequential') => setDispatchMethod(value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="parallel" id="parallel" />
                        <Label htmlFor="parallel" className="text-sm">Parallel (All functions)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="round-robin" id="round-robin" />
                        <Label htmlFor="round-robin" className="text-sm">Round Robin</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sequential" id="sequential" />
                        <Label htmlFor="sequential" className="text-sm">Sequential</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Selection */}
            <CompactAccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={setSelectedAccounts}
              onSelectAll={handleSelectAllAccounts}
              onDeselectAll={handleDeselectAllAccounts}
            />

            {/* Campaign Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromName" className="text-sm">
                      From Name {!useFromRotation && '*'}
                    </Label>
                    <Input
                      id="fromName"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Your Name"
                      className="mt-1"
                      disabled={useFromRotation}
                      required={!useFromRotation}
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject" className="text-sm">
                      Subject {!useSubjectRotation && '*'}
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email Subject"
                      className="mt-1"
                      disabled={useSubjectRotation}
                      required={!useSubjectRotation}
                    />
                  </div>
                </div>

                {/* Rotation Options */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    <Label className="text-sm font-medium">Rotation Options</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="useFromRotation" className="text-sm">From Name Rotation</Label>
                        <Switch
                          id="useFromRotation"
                          checked={useFromRotation}
                          onCheckedChange={setUseFromRotation}
                        />
                      </div>
                      {useFromRotation && (
                        <Textarea
                          placeholder="Variation 1, Variation 2, Variation 3..."
                          value={fromNameVariations}
                          onChange={(e) => setFromNameVariations(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="useSubjectRotation" className="text-sm">Subject Rotation</Label>
                        <Switch
                          id="useSubjectRotation"
                          checked={useSubjectRotation}
                          onCheckedChange={setUseSubjectRotation}
                        />
                      </div>
                      {useSubjectRotation && (
                        <Textarea
                          placeholder="Subject 1, Subject 2, Subject 3..."
                          value={subjectVariations}
                          onChange={(e) => setSubjectVariations(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      )}
                    </div>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="htmlContent" className="text-sm">HTML Content *</Label>
                    <Dialog open={htmlPreviewOpen} onOpenChange={setHtmlPreviewOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" type="button">
                          <Eye className="w-3 h-3 mr-1" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>HTML Preview</DialogTitle>
                        </DialogHeader>
                        <div className="border rounded p-4">
                          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
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

            {/* Test-After Configuration - OLD WAY */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Test-After Configuration (Auto-Inject Method)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useTestAfter" className="text-sm">Enable Test-After (Auto-inject)</Label>
                  <Switch
                    id="useTestAfter"
                    checked={useTestAfter}
                    onCheckedChange={setUseTestAfter}
                  />
                </div>
                
                {useTestAfter && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="testAfterEmail" className="text-sm">Test Email *</Label>
                      <Input
                        id="testAfterEmail"
                        type="email"
                        value={testAfterEmail}
                        onChange={(e) => setTestAfterEmail(e.target.value)}
                        placeholder="test@example.com"
                        className="mt-1"
                        required={useTestAfter}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="testAfterCount" className="text-sm">Inject Every X Emails</Label>
                      <Input
                        id="testAfterCount"
                        type="number"
                        min="1"
                        max="1000"
                        value={testAfterCount}
                        onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 1)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                
                {useTestAfter && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Target className="h-4 w-4" />
                    <AlertDescription className="text-blue-800 text-xs">
                      Test emails will be automatically injected into the recipient list every {testAfterCount} emails. This uses the old reliable method of direct list injection.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Tracking Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Email Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Track Opens & Clicks</Label>
                    <p className="text-xs text-gray-600">Monitor email engagement</p>
                  </div>
                  <Switch
                    checked={trackingEnabled}
                    onCheckedChange={setTrackingEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Alert className={hasAccounts && hasFunctions ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <Target className="h-4 w-4" />
              <AlertDescription>
                {hasAccounts && hasFunctions ? (
                  <span className="text-green-800 text-sm">
                    <strong>✅ Ready to Create Campaign</strong>
                    {estimatedTime && ` • Estimated send time: ${estimatedTime}`}
                  </span>
                ) : (
                  <div className="text-yellow-800 text-sm">
                    <strong>⚠️ Setup Required:</strong>
                    {!hasFunctions && " Configure Cloud Functions"}
                    {!hasFunctions && !hasAccounts && " • "}
                    {!hasAccounts && " Select Email Accounts"}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            <Separator />

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={!hasFunctions || !hasAccounts || isSubmitting}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Creating Campaign...' : `Create Campaign (Draft)`}
              {recipientCount > 0 && !isSubmitting && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {recipientCount} recipients
                </Badge>
              )}
            </Button>
            
            <div className="text-center text-sm text-gray-600">
              After creating, go to <strong>Campaign History</strong> to prepare and send your campaign.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
