
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
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';
import TestAfterSection from './TestAfterSection';
import TrackingLinksManager from './TrackingLinksManager';
import { useNavigate } from 'react-router-dom';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  const { functions, loading: functionsLoading } = useGcfFunctions(currentOrganization?.id);
  
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

  // Smart config
  const [estimatedTime, setEstimatedTime] = useState('');

  useEffect(() => {
    // Load smart config if available
    try {
      const smartConfig = localStorage.getItem('smartConfig');
      if (smartConfig) {
        const config = JSON.parse(smartConfig);
        if (config.recommendedAccounts) setNumAccountsToUse(config.recommendedAccounts);
      }
    } catch (error) {
      console.error('Error loading smart config:', error);
    }
  }, []);

  const activeAccounts = accounts.filter(account => account.is_active);
  const enabledFunctions = functions.filter(func => func.enabled);
  const recipientCount = recipients.split(',').filter(email => email.trim()).length;

  // Calculate estimated time
  useEffect(() => {
    if (recipientCount > 0 && enabledFunctions.length > 0) {
      const emailsPerFunction = Math.ceil(recipientCount / enabledFunctions.length);
      const estimatedSeconds = sendingMode === 'zero-delay' 
        ? Math.ceil(emailsPerFunction / 1000) // Ultra-fast estimate for zero delay
        : Math.ceil(emailsPerFunction / 200); // Conservative estimate
      setEstimatedTime(`~${estimatedSeconds} seconds`);
    } else {
      setEstimatedTime('');
    }
  }, [recipientCount, enabledFunctions.length, sendingMode]);

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

    if ((sendingMode === 'fast' || sendingMode === 'zero-delay') && enabledFunctions.length === 0) {
      toast({
        title: "Validation Error",
        description: "No enabled Cloud Functions found. Please configure at least one function in Function Manager.",
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

    console.log('Building dynamic parallel campaign configuration...');

    const config: any = {
      sendingMode,
      selectedAccounts: useAccountSelection ? selectedAccounts : [],
      numAccountsToUse,
      
      // Subject rotation
      subjectRotation: {
        enabled: rotateSubjects,
        variations: rotateSubjects ? subjectVariations.split('\n').filter(s => s.trim()) : []
      },
      
      // From name rotation
      fromNameRotation: {
        enabled: rotateFromNames,
        variations: rotateFromNames ? fromNameVariations.split('\n').filter(s => s.trim()) : []
      },
      
      // Test-After configuration
      testAfter: {
        enabled: useTestAfter,
        email: testAfterEmail,
        count: testAfterCount
      },
      
      // Tracking configuration
      tracking: {
        enabled: trackingEnabled,
        trackOpens: trackingEnabled,
        trackClicks: trackingEnabled
      }
    };

    // Zero Delay Mode configuration
    if (sendingMode === 'zero-delay') {
      config.zeroDelayMode = true;
      config.bypassAllRateLimits = true;
      config.maxParallelSends = true;
    }

    // Google Cloud Functions config for parallel dispatch using registered functions
    if ((sendingMode === 'fast' || sendingMode === 'zero-delay') && enabledFunctions.length > 0) {
      config.googleCloudFunctions = {
        enabled: true,
        functionUrls: enabledFunctions.map(func => func.url),
        functionIds: enabledFunctions.map(func => func.id), // Store function IDs for last_used updates
        parallelDispatch: true,
        zeroDelayMode: sendingMode === 'zero-delay'
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

    console.log('Final parallel campaign data:', campaignData);
    onSend(campaignData);
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
            {/* Function Status */}
            {(sendingMode === 'fast' || sendingMode === 'zero-delay') && (
              <Alert className={enabledFunctions.length > 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  {enabledFunctions.length > 0 ? (
                    <span className="text-green-800">
                      <strong>{enabledFunctions.length} Cloud Functions</strong> ready for parallel dispatch
                    </span>
                  ) : (
                    <div className="text-red-800">
                      <strong>No Cloud Functions configured.</strong>{' '}
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-red-800 underline"
                        onClick={() => navigate('/function-manager')}
                      >
                        Configure functions here
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

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
                      <Label htmlFor="fast" className="font-medium">Fast Parallel Send</Label>
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
                      <Label htmlFor="zero-delay" className="font-medium">Zero Delay Mode</Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Maximum speed, no delays
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {sendingMode === 'zero-delay' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Zero Delay Mode:</strong> Bypasses ALL rate limits for maximum speed.
                    Best for bulk campaigns with dedicated sending infrastructure.
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

            {/* From Name Rotation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rotate From Names</Label>
                  <p className="text-sm text-gray-600">
                    Use different from names to improve deliverability
                  </p>
                </div>
                <Switch
                  checked={rotateFromNames}
                  onCheckedChange={setRotateFromNames}
                />
              </div>
              {rotateFromNames && (
                <div>
                  <Label htmlFor="fromNameVariations">From Name Variations (one per line)</Label>
                  <Textarea
                    id="fromNameVariations"
                    value={fromNameVariations}
                    onChange={(e) => setFromNameVariations(e.target.value)}
                    placeholder="John Smith&#10;Jane Doe&#10;Mike Johnson"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Subject Rotation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rotate Subjects</Label>
                  <p className="text-sm text-gray-600">
                    Use different subject lines to improve engagement
                  </p>
                </div>
                <Switch
                  checked={rotateSubjects}
                  onCheckedChange={setRotateSubjects}
                />
              </div>
              {rotateSubjects && (
                <div>
                  <Label htmlFor="subjectVariations">Subject Variations (one per line)</Label>
                  <Textarea
                    id="subjectVariations"
                    value={subjectVariations}
                    onChange={(e) => setSubjectVariations(e.target.value)}
                    placeholder="Great offer for you!&#10;Don't miss this deal&#10;Special promotion inside"
                    rows={3}
                  />
                </div>
              )}
            </div>

            {estimatedTime && enabledFunctions.length > 0 && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Estimated Delivery Time:</strong> {estimatedTime} using {enabledFunctions.length} functions and {numAccountsToUse} accounts
                </AlertDescription>
              </Alert>
            )}

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

            {/* Manual Account Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Manual Account Selection</Label>
                  <p className="text-sm text-gray-600">
                    Choose specific sender accounts instead of automatic rotation
                  </p>
                </div>
                <Switch
                  checked={useAccountSelection}
                  onCheckedChange={setUseAccountSelection}
                />
              </div>

              {useAccountSelection && (
                <div className="space-y-4">
                  <Label>Select Sender Accounts</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                    {activeAccounts.map((account) => (
                      <div key={account.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={account.id}
                          checked={selectedAccounts.includes(account.id)}
                          onChange={() => handleAccountToggle(account.id)}
                          className="rounded"
                        />
                        <Label htmlFor={account.id} className="text-sm flex-1">
                          {account.email} ({account.provider})
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedAccounts.length > 0 && (
                    <p className="text-sm text-green-600">
                      {selectedAccounts.length} accounts selected
                    </p>
                  )}
                </div>
              )}

              {!useAccountSelection && (
                <div>
                  <Label htmlFor="numAccounts">Number of Sender Accounts</Label>
                  <Input
                    id="numAccounts"
                    type="number"
                    min={1}
                    max={activeAccounts.length}
                    value={numAccountsToUse}
                    onChange={(e) => setNumAccountsToUse(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Rotates through available accounts (max: {activeAccounts.length})
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Function and Account Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Cloud Functions</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {enabledFunctions.length}
                </div>
                <p className="text-sm text-gray-600">
                  Enabled functions
                </p>
                {enabledFunctions.length === 0 && (
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-sm"
                    onClick={() => navigate('/function-manager')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Configure Functions
                  </Button>
                )}
              </div>
              <div className="p-4 border rounded-lg bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Sender Accounts</span>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {useAccountSelection ? selectedAccounts.length : Math.min(numAccountsToUse, activeAccounts.length)}
                </div>
                <p className="text-sm text-gray-600">
                  Will be used
                </p>
              </div>
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

            <Separator />

            {/* Tracking Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Tracking</Label>
                  <p className="text-sm text-gray-600">
                    Include tracking pixels and click tracking
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
              disabled={accountsLoading || functionsLoading}
            >
              {sendingMode === 'zero-delay' ? (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Launch Zero Delay Campaign
                </>
              ) : sendingMode === 'fast' ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Start Fast Parallel Campaign
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
