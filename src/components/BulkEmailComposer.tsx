import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Zap, Settings, AlertTriangle, Rocket } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import TestAfterSection from './TestAfterSection';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  
  // Form state
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Sending mode state - updated with new zero delay mode
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  
  // Test-After state
  const [useTestAfter, setUseTestAfter] = useState(false);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(100);
  
  // Account selection state
  const [useAccountSelection, setUseAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Rate limiting state (only for controlled mode)
  const [useCustomRateLimit, setUseCustomRateLimit] = useState(false);
  const [emailsPerSecond, setEmailsPerSecond] = useState<{ [accountId: string]: number }>({});
  const [delayInSeconds, setDelayInSeconds] = useState<{ [accountId: string]: number }>({});
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState<{ [accountId: string]: number }>({});
  
  // Rotation state
  const [useFromNameRotation, setUseFromNameRotation] = useState(false);
  const [fromNames, setFromNames] = useState<string[]>(['']);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(['']);

  // Google Cloud Functions configuration state
  const [useGoogleCloudFunctions, setUseGoogleCloudFunctions] = useState(false);
  const [googleCloudFunctionUrl, setGoogleCloudFunctionUrl] = useState('');

  useEffect(() => {
    // Load saved settings
    try {
      const savedSettings = localStorage.getItem('emailCampaignSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.googleCloudFunctions?.enabled) {
          setUseGoogleCloudFunctions(true);
          setGoogleCloudFunctionUrl(settings.googleCloudFunctions.functionUrl || '');
        }
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }, []);

  const activeAccounts = accounts.filter(account => account.is_active);

  const addFromName = () => {
    setFromNames([...fromNames, '']);
  };

  const removeFromName = (index: number) => {
    if (fromNames.length > 1) {
      setFromNames(fromNames.filter((_, i) => i !== index));
    }
  };

  const updateFromName = (index: number, value: string) => {
    const updated = [...fromNames];
    updated[index] = value;
    setFromNames(updated);
  };

  const addSubject = () => {
    setSubjects([...subjects, '']);
  };

  const removeSubject = (index: number) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const updateSubject = (index: number, value: string) => {
    const updated = [...subjects];
    updated[index] = value;
    setSubjects(updated);
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleEmailsPerSecondChange = (accountId: string, value: string) => {
    const numValue = parseInt(value) || 1;
    setEmailsPerSecond(prev => ({
      ...prev,
      [accountId]: numValue
    }));
  };

  const handleDelayInSecondsChange = (accountId: string, value: string) => {
    const numValue = parseInt(value) || 1;
    setDelayInSeconds(prev => ({
      ...prev,
      [accountId]: numValue
    }));
  };

  const handleMaxEmailsPerHourChange = (accountId: string, value: string) => {
    const numValue = parseInt(value) || 3600;
    setMaxEmailsPerHour(prev => ({
      ...prev,
      [accountId]: numValue
    }));
  };

  const handleCSVImport = (data: Array<{ [key: string]: any }>) => {
    // Extract email addresses from the imported data
    const emails = data.map(row => {
      // Look for common email field names
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

    if (useAccountSelection && selectedAccounts.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one email account for sending",
        variant: "destructive"
      });
      return false;
    }

    if ((sendingMode === 'fast' || sendingMode === 'zero-delay') && useGoogleCloudFunctions && !googleCloudFunctionUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Google Cloud Function URL is required for Fast Bulk Send Mode and Zero Delay Mode",
        variant: "destructive"
      });
      return false;
    }

    if (useTestAfter && !testAfterEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Test-After email address is required when enabled",
        variant: "destructive"
      });
      return false;
    }

    if (useTestAfter && testAfterCount < 1) {
      toast({
        title: "Validation Error",
        description: "Test-After count must be at least 1",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Build configuration object
    const config: any = {
      sendingMode,
      selectedAccounts: useAccountSelection ? selectedAccounts : [],
      useFromNameRotation,
      fromNames: useFromNameRotation ? fromNames.filter(name => name.trim()) : [],
      useSubjectRotation, 
      subjects: useSubjectRotation ? subjects.filter(subj => subj.trim()) : [],
      
      // Automatically include test-after configuration
      useTestAfter,
      testAfterEmail: useTestAfter ? testAfterEmail : '',
      testAfterCount: useTestAfter ? testAfterCount : 100
    };

    // Zero Delay Mode configuration - completely bypass all rate limits
    if (sendingMode === 'zero-delay') {
      config.forceFastSend = true;
      config.useCustomRateLimit = true;
      config.zeroDelayMode = true;
      config.bypassAllRateLimits = true; // New flag to bypass account rate limits
      
      // Set unlimited speed settings for all accounts
      const zeroDelaySettings = {
        emailsPerSecond: {},
        delayInSeconds: {},
        maxEmailsPerHour: {}
      };
      
      activeAccounts.forEach(account => {
        zeroDelaySettings.emailsPerSecond[account.id] = 999999; // Unlimited speed
        zeroDelaySettings.delayInSeconds[account.id] = 0;       // No delay
        zeroDelaySettings.maxEmailsPerHour[account.id] = 999999; // Unlimited per hour
      });
      
      config.customRateLimit = zeroDelaySettings;
    }
    // Add rate limiting config only for controlled mode
    else if (sendingMode === 'controlled' && useCustomRateLimit) {
      config.useCustomRateLimit = true;
      config.customRateLimit = {
        emailsPerSecond,
        delayInSeconds,
        maxEmailsPerHour
      };
    }

    // Add Google Cloud Functions config for fast modes
    if ((sendingMode === 'fast' || sendingMode === 'zero-delay') && useGoogleCloudFunctions) {
      config.googleCloudFunctions = {
        enabled: true,
        functionUrl: googleCloudFunctionUrl,
        fastMode: sendingMode === 'fast',
        zeroDelayMode: sendingMode === 'zero-delay',
        bypassRateLimits: sendingMode === 'zero-delay' // Bypass all rate limits in zero delay mode
      };
    }

    const campaignData = {
      from_name: fromName,
      subject,
      recipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'smtp',
      config
    };

    console.log('Campaign data with enhanced configuration:', campaignData);
    onSend(campaignData);
  };

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Bulk Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sending Mode Selection - Updated with Zero Delay Mode */}
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
                      <Label htmlFor="controlled" className="font-medium">Controlled Send Mode</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Customizable delay between emails for better deliverability
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="fast" id="fast" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <Label htmlFor="fast" className="font-medium">Fast Bulk Send Mode</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      High speed sending with minimal delays
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="zero-delay" id="zero-delay" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-red-600" />
                      <Label htmlFor="zero-delay" className="font-medium">Zero Delay Mode</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Maximum speed with no delays (1000+ emails in seconds)
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* Zero Delay Mode Warning */}
              {sendingMode === 'zero-delay' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> Zero Delay Mode sends emails at maximum speed with no throttling. 
                    Only use with reliable SMTP servers and ensure your accounts can handle high-volume sending 
                    to avoid being flagged as spam.
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

            {/* AI Subject Generator */}
            <AISubjectGenerator onSubjectSelect={setSubject} />

            {/* Recipients */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="recipients">Recipients *</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </Badge>
                  {sendingMode === 'zero-delay' && recipientCount > 0 && (
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      Est. time: ~{Math.ceil(recipientCount / 1000)} seconds
                    </Badge>
                  )}
                </div>
              </div>
              <Textarea
                id="recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com, ..."
                rows={4}
                required
              />
              
              {/* Import Tools */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CSVDataImporter onImport={handleCSVImport} />
                <GoogleSheetsImport onImport={handleGoogleSheetsImport} />
              </div>
            </div>

            {/* Email Content */}
            <div className="space-y-4">
              <Label htmlFor="htmlContent">HTML Content</Label>
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<h1>Your HTML content here...</h1>"
                rows={6}
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

            {/* Test-After Email Section */}
            <TestAfterSection
              useTestAfter={useTestAfter}
              onUseTestAfterChange={setUseTestAfter}
              testAfterEmail={testAfterEmail}
              onTestAfterEmailChange={setTestAfterEmail}
              testAfterCount={testAfterCount}
              onTestAfterCountChange={setTestAfterCount}
            />

            <Separator />

            {/* Advanced Configuration */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Advanced Configuration</h3>

              {/* Test-After Configuration - Always shown */}
              <TestAfterSection
                useTestAfter={useTestAfter}
                onUseTestAfterChange={setUseTestAfter}
                testAfterEmail={testAfterEmail}
                onTestAfterEmailChange={setTestAfterEmail}
                testAfterCount={testAfterCount}
                onTestAfterCountChange={setTestAfterCount}
              />

              {/* Account Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Account Selection</Label>
                  <Switch
                    checked={useAccountSelection}
                    onCheckedChange={setUseAccountSelection}
                  />
                </div>
                
                {useAccountSelection && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Select accounts to use for sending:</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {activeAccounts.map((account) => (
                        <div key={account.id} className="flex items-center space-x-2 p-2 border rounded">
                          <input
                            type="checkbox"
                            id={`account-${account.id}`}
                            checked={selectedAccounts.includes(account.id)}
                            onChange={() => handleAccountToggle(account.id)}
                            className="rounded"
                          />
                          <Label htmlFor={`account-${account.id}`} className="flex-1 text-sm">
                            {account.name} ({account.email})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rate Limiting - Only for Controlled Mode */}
              {sendingMode === 'controlled' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Custom Rate Limiting</Label>
                      <p className="text-sm text-gray-600">Override account default settings with custom rate limits</p>
                    </div>
                    <Switch
                      checked={useCustomRateLimit}
                      onCheckedChange={setUseCustomRateLimit}
                    />
                  </div>
                  
                  {useCustomRateLimit && (
                    <div className="space-y-3">
                      <Label className="text-sm text-gray-600">Configure custom rate limits for each account:</Label>
                      {activeAccounts.map((account) => (
                        <div key={account.id} className="p-4 border rounded-lg space-y-3">
                          <Label className="font-medium">{account.name} ({account.email})</Label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center space-x-3">
                              <Label className="text-sm min-w-0">Emails per second:</Label>
                              <Input
                                type="number"
                                value={emailsPerSecond[account.id] || 1}
                                onChange={(e) => handleEmailsPerSecondChange(account.id, e.target.value)}
                                className="w-20"
                                min="1"
                                max="100"
                              />
                              <span className="text-sm text-gray-500">/sec</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Label className="text-sm min-w-0">Delay between emails:</Label>
                              <Input
                                type="number"
                                value={delayInSeconds[account.id] || 2}
                                onChange={(e) => handleDelayInSecondsChange(account.id, e.target.value)}
                                className="w-20"
                                min="1"
                                max="60"
                              />
                              <span className="text-sm text-gray-500">seconds</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Label className="text-sm min-w-0">Max per hour:</Label>
                              <Input
                                type="number"
                                value={maxEmailsPerHour[account.id] || 2000}
                                onChange={(e) => handleMaxEmailsPerHourChange(account.id, e.target.value)}
                                className="w-24"
                                min="1"
                                max="10000"
                              />
                              <span className="text-sm text-gray-500">/hour</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Example: {emailsPerSecond[account.id] || 1} email / {delayInSeconds[account.id] || 2} seconds / {maxEmailsPerHour[account.id] || 2000} per hour
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Google Cloud Functions - For Fast and Zero Delay Modes */}
              {(sendingMode === 'fast' || sendingMode === 'zero-delay') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Google Cloud Functions (Required for Fast Modes)</Label>
                      <p className="text-sm text-gray-600">
                        {sendingMode === 'zero-delay' 
                          ? 'Zero Delay Mode requires Google Cloud Functions for maximum parallel processing'
                          : 'Fast Bulk Send Mode requires Google Cloud Functions for high performance'
                        }
                      </p>
                    </div>
                    <Switch
                      checked={useGoogleCloudFunctions}
                      onCheckedChange={setUseGoogleCloudFunctions}
                    />
                  </div>
                  
                  {useGoogleCloudFunctions && (
                    <div className="space-y-3">
                      <Label htmlFor="gcfUrl">Function URL *</Label>
                      <Input
                        id="gcfUrl"
                        value={googleCloudFunctionUrl}
                        onChange={(e) => setGoogleCloudFunctionUrl(e.target.value)}
                        placeholder="https://your-region-your-project.cloudfunctions.net/sendEmailCampaign"
                        required={sendingMode === 'fast' || sendingMode === 'zero-delay'}
                      />
                      <p className="text-sm text-gray-600">
                        {sendingMode === 'zero-delay' 
                          ? 'Zero Delay Mode uses maximum parallel processing for ultra-fast sending'
                          : 'Fast Bulk Send Mode requires a Google Cloud Function for maximum performance'
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Zero Delay Mode displays fixed settings */}
              {sendingMode === 'zero-delay' && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <Label className="font-medium text-red-800">Zero Delay Mode Settings (Auto-configured)</Label>
                    <div className="mt-2 space-y-2 text-sm text-red-700">
                      <p>• Emails per second: UNLIMITED (no restrictions)</p>
                      <p>• Delay between emails: 0 seconds</p>
                      <p>• Max emails per hour: UNLIMITED</p>
                      <p>• Parallel processing: Full parallel mode</p>
                      <p>• Batching: Disabled for maximum speed</p>
                      <p>• Rate limiting: COMPLETELY DISABLED</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rotation Features - Available for all modes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>From Name Rotation</Label>
                  <Switch
                    checked={useFromNameRotation}
                    onCheckedChange={setUseFromNameRotation}
                  />
                </div>
                
                {useFromNameRotation && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">From names to rotate:</Label>
                    {fromNames.map((name, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={name}
                          onChange={(e) => updateFromName(index, e.target.value)}
                          placeholder={`From name ${index + 1}`}
                          className="flex-1"
                        />
                        {fromNames.length > 1 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => removeFromName(index)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addFromName}>
                      Add From Name
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Subject Rotation</Label>
                  <Switch
                    checked={useSubjectRotation}
                    onCheckedChange={setUseSubjectRotation}
                  />
                </div>
                
                {useSubjectRotation && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Subjects to rotate:</Label>
                    {subjects.map((subj, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={subj}
                          onChange={(e) => updateSubject(index, e.target.value)}
                          placeholder={`Subject line ${index + 1}`}
                          className="flex-1"
                        />
                        {subjects.length > 1 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => removeSubject(index)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addSubject}>
                      Add Subject
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={accountsLoading}
            >
              {sendingMode === 'zero-delay' ? (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Zero Delay Campaign
                </>
              ) : sendingMode === 'fast' ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create Fast Bulk Campaign
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Create Controlled Campaign
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
