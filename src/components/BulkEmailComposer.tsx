
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
import { Clock, Zap, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';
import AISubjectGenerator from './AISubjectGenerator';

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
  
  // Sending mode state
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast'>('controlled');
  
  // Account selection state
  const [useAccountSelection, setUseAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Rate limiting state (only for controlled mode)
  const [useCustomRateLimit, setUseCustomRateLimit] = useState(false);
  const [emailsPerHour, setEmailsPerHour] = useState<{ [accountId: string]: number }>({});
  
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

  const handleRateLimitChange = (accountId: string, value: string) => {
    const numValue = parseInt(value) || 3600;
    setEmailsPerHour(prev => ({
      ...prev,
      [accountId]: numValue
    }));
  };

  const handleCSVImport = (data: string[]) => {
    const emailList = data.join(', ');
    setRecipients(emailList);
    toast({
      title: "Success",
      description: `Imported ${data.length} email addresses`
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

    if (sendingMode === 'fast' && useGoogleCloudFunctions && !googleCloudFunctionUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Google Cloud Function URL is required for Fast Bulk Send Mode",
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
      subjects: useSubjectRotation ? subjects.filter(subj => subj.trim()) : []
    };

    // Add rate limiting config only for controlled mode
    if (sendingMode === 'controlled' && useCustomRateLimit) {
      config.customRateLimit = emailsPerHour;
    }

    // Add Google Cloud Functions config for fast mode
    if (sendingMode === 'fast' && useGoogleCloudFunctions) {
      config.googleCloudFunctions = {
        enabled: true,
        functionUrl: googleCloudFunctionUrl,
        fastMode: true
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

    console.log('Campaign data with sending mode:', campaignData);
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
            {/* Sending Mode Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Sending Mode</Label>
              <RadioGroup 
                value={sendingMode} 
                onValueChange={(value: 'controlled' | 'fast') => setSendingMode(value)}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
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
                      Maximum speed sending with no delays (requires Google Cloud)
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

            {/* AI Subject Generator */}
            <AISubjectGenerator onSubjectGenerated={setSubject} />

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
                    <Label>Custom Rate Limiting</Label>
                    <Switch
                      checked={useCustomRateLimit}
                      onCheckedChange={setUseCustomRateLimit}
                    />
                  </div>
                  
                  {useCustomRateLimit && (
                    <div className="space-y-3">
                      <Label className="text-sm text-gray-600">Emails per hour for each account:</Label>
                      {activeAccounts.map((account) => (
                        <div key={account.id} className="flex items-center space-x-3">
                          <Label className="flex-1 text-sm">{account.name}:</Label>
                          <Input
                            type="number"
                            value={emailsPerHour[account.id] || 3600}
                            onChange={(e) => handleRateLimitChange(account.id, e.target.value)}
                            className="w-24"
                            min="1"
                            max="10000"
                          />
                          <span className="text-sm text-gray-500">emails/hour</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Google Cloud Functions - Only for Fast Mode */}
              {sendingMode === 'fast' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Google Cloud Functions (Required for Fast Mode)</Label>
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
                        required={sendingMode === 'fast'}
                      />
                      <p className="text-sm text-gray-600">
                        Fast Bulk Send Mode requires a Google Cloud Function for maximum performance
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Rotation Features */}
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
              {sendingMode === 'fast' ? (
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
