
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Loader2, Settings, Zap, Server, Cloud, Target } from 'lucide-react';
import CompactAccountSelector from './CompactAccountSelector';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer: React.FC<BulkEmailComposerProps> = ({ onSend }) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  const { functions } = useGcfFunctions(currentOrganization?.id);
  const { servers } = usePowerMTAServers(currentOrganization?.id);
  
  // Basic campaign fields
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Send method configuration
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState<string>('');

  // Content Rotation
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [fromNameVariations, setFromNameVariations] = useState<string[]>([]);
  const [subjectVariations, setSubjectVariations] = useState<string[]>([]);

  // Smart Configuration
  const [smartConfigEnabled, setSmartConfigEnabled] = useState(false);
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [batchSize, setBatchSize] = useState(50);
  const [autoRetryFailed, setAutoRetryFailed] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);

  // Sending Configuration
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  const [useTestAfter, setUseTestAfter] = useState(false);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(10);
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  const recipientCount = recipients.split('\n').filter(email => email.trim()).length;
  const activeAccounts = accounts.filter(account => account.is_active);
  const enabledFunctions = functions.filter(func => func.enabled);
  const activeServers = servers.filter(server => server.is_active);
  const hasAccounts = activeAccounts.length > 0;
  const hasFunctions = enabledFunctions.length > 0;
  const hasPowerMTAServers = activeServers.length > 0;

  // Auto-select first PowerMTA server when switching to PowerMTA method
  useEffect(() => {
    if (sendMethod === 'powermta' && activeServers.length > 0 && !selectedPowerMTAServer) {
      setSelectedPowerMTAServer(activeServers[0].id);
    }
  }, [sendMethod, activeServers, selectedPowerMTAServer]);

  // Handle subject variations
  const handleSubjectVariationsChange = (value: string) => {
    const variations = value.split('\n').filter(line => line.trim());
    setSubjectVariations(variations);
  };

  // Handle from name variations
  const handleFromNameVariationsChange = (value: string) => {
    const variations = value.split('\n').filter(line => line.trim());
    setFromNameVariations(variations);
  };

  // Calculate estimated time based on mode and recipient count
  const getEstimatedTime = () => {
    if (recipientCount === 0) return '';
    
    const delays = {
      'controlled': smartConfigEnabled ? delayBetweenEmails : 2000,
      'fast': 500,
      'zero-delay': 0
    };
    
    const totalTime = recipientCount * delays[sendingMode];
    if (totalTime < 60000) {
      return `${Math.round(totalTime / 1000)}s`;
    } else {
      return `${Math.round(totalTime / 60000)}m`;
    }
  };

  const handleSelectAll = () => {
    const allAccountIds = activeAccounts.map(account => account.id);
    setSelectedAccounts(allAccountIds);
  };

  const handleDeselectAll = () => {
    setSelectedAccounts([]);
  };

  const handleSend = async () => {
    if (!fromName || !subject || !recipients) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one email account');
      return;
    }

    if (sendMethod === 'powermta' && !selectedPowerMTAServer) {
      toast.error('Please select a PowerMTA server');
      return;
    }

    // Validate rotation settings
    if (useFromRotation && fromNameVariations.length === 0) {
      toast.error('Please add from name variations or disable from rotation');
      return;
    }

    if (useSubjectRotation && subjectVariations.length === 0) {
      toast.error('Please add subject variations or disable subject rotation');
      return;
    }

    setSending(true);
    
    try {
      const campaignData = {
        from_name: fromName,
        subject,
        recipients,
        html_content: htmlContent,
        text_content: textContent,
        send_method: sendMethod,
        config: {
          // Account selection
          selectedAccounts,
          
          // Send method configuration
          sendMethod,
          selectedPowerMTAServer: sendMethod === 'powermta' ? selectedPowerMTAServer : null,
          
          // Content rotation settings
          useFromRotation,
          useSubjectRotation,
          fromNameVariations: useFromRotation ? fromNameVariations : [],
          subjectVariations: useSubjectRotation ? subjectVariations : [],
          
          // Smart config settings
          smartConfigEnabled,
          delayBetweenEmails: smartConfigEnabled ? delayBetweenEmails : 2000,
          batchSize: smartConfigEnabled ? batchSize : 50,
          autoRetryFailed,
          maxRetries,
          
          // Sending configuration
          sendingMode,
          useTestAfter,
          testAfterEmail,
          testAfterCount,
          trackingEnabled,
          
          // Performance settings
          estimatedTime: getEstimatedTime()
        }
      };

      await onSend(campaignData);
      
      // Reset form after successful creation
      setFromName('');
      setSubject('');
      setRecipients('');
      setHtmlContent('');
      setTextContent('');
      setSelectedAccounts([]);
      setSelectedPowerMTAServer('');
      setSubjectVariations([]);
      setFromNameVariations([]);
    } catch (error) {
      console.error('Campaign creation failed:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Create Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campaign Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from_name">From Name *</Label>
                  <Input
                    id="from_name"
                    placeholder="Your Name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Email Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="recipients">
                  Recipients * 
                  {recipientCount > 0 && <Badge variant="secondary" className="ml-2">{recipientCount} recipients</Badge>}
                </Label>
                <Textarea
                  id="recipients"
                  placeholder="Enter email addresses (one per line or comma-separated)"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Rotation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Rotation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">From Name Rotation</Label>
                    <input
                      type="checkbox"
                      checked={useFromRotation}
                      onChange={(e) => setUseFromRotation(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Rotate sender names</p>
                  {useFromRotation && (
                    <Textarea
                      placeholder="Enter from name variations (one per line)"
                      value={fromNameVariations.join('\n')}
                      onChange={(e) => handleFromNameVariationsChange(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Subject Rotation</Label>
                    <input
                      type="checkbox"
                      checked={useSubjectRotation}
                      onChange={(e) => setUseSubjectRotation(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Rotate email subjects</p>
                  {useSubjectRotation && (
                    <Textarea
                      placeholder="Enter subject variations (one per line)"
                      value={subjectVariations.join('\n')}
                      onChange={(e) => handleSubjectVariationsChange(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Smart Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Smart Config</Label>
                  <p className="text-xs text-gray-500">Use Manual Configuration Override</p>
                </div>
                <input
                  type="checkbox"
                  checked={smartConfigEnabled}
                  onChange={(e) => setSmartConfigEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {smartConfigEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm">Delay Between Emails (ms)</Label>
                    <Input
                      type="number"
                      value={delayBetweenEmails}
                      onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value) || 2000)}
                      min="100"
                      max="30000"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Batch Size</Label>
                    <Input
                      type="number"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                      min="1"
                      max="1000"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Auto Retry Failed</Label>
                    <input
                      type="checkbox"
                      checked={autoRetryFailed}
                      onChange={(e) => setAutoRetryFailed(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Max Retries</Label>
                    <Input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                      min="1"
                      max="10"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sending Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Sending Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dispatch Method */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Dispatch Method</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant={sendMethod === 'cloud_functions' ? 'default' : 'outline'}
                    onClick={() => setSendMethod('cloud_functions')}
                    className="h-auto p-4 flex flex-col items-center justify-center space-y-2"
                    disabled={!hasFunctions}
                  >
                    <Cloud className="w-6 h-6" />
                    <div className="text-center">
                      <div className="font-medium">Parallel (All functions)</div>
                      <div className="text-xs opacity-70">{enabledFunctions.length} functions</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant={sendMethod === 'powermta' ? 'default' : 'outline'}
                    onClick={() => setSendMethod('powermta')}
                    className="h-auto p-4 flex flex-col items-center justify-center space-y-2"
                    disabled={!hasPowerMTAServers}
                  >
                    <Server className="w-6 h-6" />
                    <div className="text-center">
                      <div className="font-medium">Round Robin (Rotate accounts)</div>
                      <div className="text-xs opacity-70">
                        {hasPowerMTAServers ? `${activeServers.length} servers` : 'Setup Required'}
                      </div>
                    </div>
                  </Button>
                </div>

                {sendMethod === 'powermta' && hasPowerMTAServers && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium mb-2 block">Select PowerMTA Server:</Label>
                    <div className="space-y-2">
                      {activeServers.map((server) => (
                        <Button
                          key={server.id}
                          variant={selectedPowerMTAServer === server.id ? 'default' : 'outline'}
                          onClick={() => setSelectedPowerMTAServer(server.id)}
                          className="w-full justify-start"
                          size="sm"
                        >
                          <Server className="w-4 h-4 mr-2" />
                          {server.name} ({server.server_host})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sending Mode */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Sending Mode</Label>
                <div className="space-y-2">
                  {[
                    { value: 'controlled', label: 'Controlled (2s delay)', description: 'Safe sending with delays' },
                    { value: 'fast', label: 'Fast (0.5s delay)', description: 'Faster sending' },
                    { value: 'zero-delay', label: 'Zero Delay (Max Speed)', description: 'Maximum speed' }
                  ].map((mode) => (
                    <div key={mode.value} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id={mode.value}
                        name="sendingMode"
                        value={mode.value}
                        checked={sendingMode === mode.value}
                        onChange={(e) => setSendingMode(e.target.value as any)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <Label htmlFor={mode.value} className="text-sm font-medium cursor-pointer">
                          {mode.label}
                        </Label>
                        <p className="text-xs text-gray-500">{mode.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {recipientCount > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    Estimated time: {getEstimatedTime()}
                  </p>
                )}
              </div>

              {/* Additional Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">From Name Rotation</Label>
                    <span className="text-xs text-gray-500">
                      {useFromRotation ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Subject Rotation</Label>
                    <span className="text-xs text-gray-500">
                      {useSubjectRotation ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Test After</Label>
                    <input
                      type="checkbox"
                      checked={useTestAfter}
                      onChange={(e) => setUseTestAfter(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                  {useTestAfter && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="test@email.com"
                        value={testAfterEmail}
                        onChange={(e) => setTestAfterEmail(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Count"
                        value={testAfterCount}
                        onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 10)}
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <CompactAccountSelector
                selectedAccounts={selectedAccounts}
                onAccountsChange={setSelectedAccounts}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="html_content">HTML Content</Label>
                <Textarea
                  id="html_content"
                  placeholder="<h1>Hello!</h1><p>Your HTML email content here...</p>"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={8}
                />
              </div>

              <div>
                <Label htmlFor="text_content">Plain Text Content (Optional)</Label>
                <Textarea
                  id="text_content"
                  placeholder="Your plain text email content here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Send Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0 || (sendMethod === 'powermta' && !selectedPowerMTAServer)}
              size="lg"
              className="min-w-[200px]"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create Campaign Draft
                </>
              )}
            </Button>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Note:</strong> This will create a campaign draft. Go to Campaign History to prepare and send your campaign.
              {sendMethod === 'powermta' && selectedPowerMTAServer && (
                <><br/><strong>PowerMTA:</strong> Campaign will be queued to the selected PowerMTA server for distribution.</>
              )}
              {(useFromRotation || useSubjectRotation) && (
                <><br/><strong>Rotation:</strong> Content will be rotated during campaign preparation.</>
              )}
              {smartConfigEnabled && (
                <><br/><strong>Smart Config:</strong> Advanced timing and retry settings will be applied.</>
              )}
              <br/><strong>PowerMTA Servers:</strong> Configure PowerMTA servers in Settings → PowerMTA Servers tab.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
