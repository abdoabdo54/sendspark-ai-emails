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
import TrackingLinksManager from './TrackingLinksManager';

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
  
  // Test-After state - ALWAYS ENABLED by default
  const [useTestAfter, setUseTestAfter] = useState(true);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(100);
  
  // Account selection state
  const [useAccountSelection, setUseAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Rotation state
  const [useFromNameRotation, setUseFromNameRotation] = useState(false);
  const [fromNames, setFromNames] = useState<string[]>(['']);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(['']);

  // Google Cloud Functions configuration state
  const [useGoogleCloudFunctions, setUseGoogleCloudFunctions] = useState(false);
  const [googleCloudFunctionUrl, setGoogleCloudFunctionUrl] = useState('');

  // Tracking state - User controlled
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(false);

  // Smart config overrides
  const [numFunctions, setNumFunctions] = useState(1);
  const [numAccounts, setNumAccounts] = useState(1);
  const [estimatedTime, setEstimatedTime] = useState('');

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('smartConfig');
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.recommendedFunctions) setNumFunctions(cfg.recommendedFunctions);
        if (cfg.recommendedAccounts) setNumAccounts(cfg.recommendedAccounts);
      }
    } catch (err) {
      console.error('Error loading smartConfig:', err);
    }
  }, []);

  const activeAccounts = accounts.filter(account => account.is_active);

  // Function to automatically insert test emails into recipient list
  const insertTestAfterEmails = (recipientList: string, testEmail: string, interval: number) => {
    if (!testEmail.trim()) return recipientList;
    
    const emails = recipientList.split(',').map(email => email.trim()).filter(email => email);
    const result = [];
    
    for (let i = 0; i < emails.length; i++) {
      result.push(emails[i]);
      
      // Insert test email after every interval
      if ((i + 1) % interval === 0 && i < emails.length - 1) {
        result.push(testEmail);
      }
    }
    
    // Always add test email at the end
    if (emails.length > 0) {
      result.push(testEmail);
    }
    
    return result.join(', ');
  };

  // Function to add analytics tracking to HTML content - only if user enabled it
  const addAnalyticsTracking = (htmlContent: string, campaignId: string) => {
    if (!htmlContent || !autoTrackingEnabled) return htmlContent;
    
    // Add tracking pixel for opens
    const trackingPixel = `<img src="${window.location.origin}/functions/v1/track-open?campaign={{campaign_id}}&email={{email}}" width="1" height="1" style="display:none;" />`;
    
    // Add click tracking to all links
    let trackedContent = htmlContent.replace(
      /<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi,
      `<a $1${window.location.origin}/functions/v1/track-click?campaign={{campaign_id}}&email={{email}}&url=$2$3>`
    );
    
    // Add tracking pixel at the end of the body or at the end if no body tag
    if (trackedContent.includes('</body>')) {
      trackedContent = trackedContent.replace('</body>', `${trackingPixel}</body>`);
    } else {
      trackedContent += trackingPixel;
    }
    
    return trackedContent;
  };

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

    // Test-After validation - since it's always enabled now
    if (!testAfterEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Test-After email address is required",
        variant: "destructive"
      });
      return false;
    }

    if (testAfterCount < 1) {
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

    console.log('Building campaign configuration...');

    // Automatically insert test emails into recipient list
    const finalRecipients = insertTestAfterEmails(recipients, testAfterEmail, testAfterCount);
    
    // Add analytics tracking to HTML content ONLY if user enabled it
    const trackedHtmlContent = addAnalyticsTracking(htmlContent, 'CAMPAIGN_ID_PLACEHOLDER');

    // Build configuration object - Test-After is ALWAYS included
    const config: any = {
      sendingMode,
      selectedAccounts: useAccountSelection ? selectedAccounts : [],
      useFromNameRotation,
      fromNames: useFromNameRotation ? fromNames.filter(name => name.trim()) : [],
      useSubjectRotation, 
      subjects: useSubjectRotation ? subjects.filter(subj => subj.trim()) : [],
      
      // Test-After configuration - ALWAYS INCLUDED AND ENABLED
      testAfter: {
        enabled: true,
        email: testAfterEmail,
        count: testAfterCount,
        automaticallyIncluded: true,
        insertedIntoRecipientList: true
      },
      
      // Analytics tracking - controlled by user
      analytics: {
        trackOpens: autoTrackingEnabled,
        trackClicks: autoTrackingEnabled,
        trackingEnabled: autoTrackingEnabled
      },
      numFunctions,
      numAccounts
    };

    console.log('Test-After configuration:', config.testAfter);
    console.log('Analytics configuration:', config.analytics);
    console.log('Final recipients with test emails:', finalRecipients);

    // Zero Delay Mode configuration - completely bypass all rate limits
    if (sendingMode === 'zero-delay') {
      config.forceFastSend = true;
      config.useCustomRateLimit = true;
      config.zeroDelayMode = true;
      config.bypassAllRateLimits = true;
      config.forceMaxSpeed = true;
      config.unlimitedSpeed = true;
      config.ignoreAccountRateLimits = true;
    }

    // Add Google Cloud Functions config for fast modes
    if ((sendingMode === 'fast' || sendingMode === 'zero-delay') && useGoogleCloudFunctions) {
      config.googleCloudFunctions = {
        enabled: true,
        functionUrl: googleCloudFunctionUrl,
        fastMode: sendingMode === 'fast',
        zeroDelayMode: sendingMode === 'zero-delay',
        bypassRateLimits: sendingMode === 'zero-delay',
        unlimitedSpeed: sendingMode === 'zero-delay',
        ignoreAccountLimits: true
      };
    }

    const campaignData = {
      from_name: fromName,
      subject,
      recipients: finalRecipients, // Use the modified recipient list with test emails
      html_content: trackedHtmlContent, // Use tracked HTML content only if user enabled it
      text_content: textContent,
      send_method: 'smtp',
      config
    };

    console.log('Final campaign data with user-controlled analytics and test-after:', campaignData);
    onSend(campaignData);
  };

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;
  const finalRecipientCount = useTestAfter ? 
    insertTestAfterEmails(recipients, testAfterEmail, testAfterCount).split(',').filter(email => email.trim()).length :
    recipientCount;

  useEffect(() => {
    const secs = Math.round((finalRecipientCount / (numFunctions * 5000)) * 12 + 2);
    setEstimatedTime(`${secs} sec`);
  }, [finalRecipientCount, numFunctions]);

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
                      Uses campaign-level rate limits for optimal deliverability
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
                      Maximum speed with no delays - ignores ALL rate limits
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* Zero Delay Mode Warning */}
              {sendingMode === 'zero-delay' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> Zero Delay Mode bypasses ALL rate limits including account-level limits. 
                    This sends emails at maximum speed with automatic analytics tracking and test-after integration.
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

            <p className="text-sm text-gray-600">Estimated time: {estimatedTime}</p>

            {/* AI Subject Generator */}
            <AISubjectGenerator onSubjectSelect={setSubject} />

            {/* Recipients */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="recipients">Recipients *</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {recipientCount} original recipient{recipientCount !== 1 ? 's' : ''}
                  </Badge>
                  {useTestAfter && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      {finalRecipientCount} total (with test emails)
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
              <Label htmlFor="htmlContent">HTML Content *</Label>
              <Textarea
                id="htmlContent"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<h1>Your HTML content here...</h1><p>Use the tracking manager below to add analytics</p>"
                rows={6}
                required
              />
              <p className="text-sm text-gray-600">
                📊 Use the tracking manager below to control analytics tracking
              </p>
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

            {/* Tracking Links Manager */}
            <TrackingLinksManager
              campaignId="CAMPAIGN_ID_PLACEHOLDER"
              onTrackingToggle={setAutoTrackingEnabled}
              onHtmlContentUpdate={setHtmlContent}
              htmlContent={htmlContent}
              autoTrackingEnabled={autoTrackingEnabled}
            />

            <Separator />

            {/* Test-After Email Section - ALWAYS VISIBLE AND ENABLED */}
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Auto Test-After:</strong> Test emails will be automatically inserted into your recipient list 
                  every {testAfterCount} emails and at the end. This ensures delivery verification throughout the campaign.
                </AlertDescription>
              </Alert>
              
              <TestAfterSection
                useTestAfter={true}
                onUseTestAfterChange={() => {}} // Disabled since always true
                testAfterEmail={testAfterEmail}
                onTestAfterEmailChange={setTestAfterEmail}
                testAfterCount={testAfterCount}
                onTestAfterCountChange={setTestAfterCount}
              />
            </div>

            <Separator />

            {/* Advanced Configuration */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Advanced Configuration</h3>

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
                    <Label className="text-sm text-gray-600">Select accounts to use for sending (rate limits removed for campaign control):</Label>
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

              {/* Google Cloud Functions - For Fast and Zero Delay Modes */}
              {(sendingMode === 'fast' || sendingMode === 'zero-delay') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Google Cloud Functions (Required for Fast Modes)</Label>
                      <p className="text-sm text-gray-600">
                        {sendingMode === 'zero-delay' 
                          ? 'Zero Delay Mode requires Google Cloud Functions for maximum speed with analytics'
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
                        placeholder="https://your-region-your-project.cloudfunctions.net/sendBatch"
                        required={sendingMode === 'fast' || sendingMode === 'zero-delay'}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="numFuncs">Functions</Label>
                          <Input id="numFuncs" type="number" min={1} value={numFunctions} onChange={e => setNumFunctions(parseInt(e.target.value))} />
                        </div>
                        <div>
                          <Label htmlFor="numAccts">Accounts</Label>
                          <Input id="numAccts" type="number" min={1} value={numAccounts} onChange={e => setNumAccounts(parseInt(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  )}
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
                  Create Zero Delay Campaign {autoTrackingEnabled && '(With Analytics)'} (Auto Test-After)
                </>
              ) : sendingMode === 'fast' ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create Fast Bulk Campaign {autoTrackingEnabled && '(With Analytics)'} (Auto Test-After)
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Create Controlled Campaign {autoTrackingEnabled && '(With Analytics)'} (Auto Test-After)
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

}
