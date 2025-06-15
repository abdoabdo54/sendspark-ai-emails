
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
import { Send, Loader2, FileText, Users, Settings, Zap } from 'lucide-react';
import AdvancedConfigurationPanel from './AdvancedConfigurationPanel';
import CompactAccountSelector from './CompactAccountSelector';
import CampaignSendMethodSelector from './CampaignSendMethodSelector';
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
  
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced configuration state - ALL original features restored
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  const [useTestAfter, setUseTestAfter] = useState(false);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(10);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);

  // Smart Config features - RESTORED
  const [smartConfigEnabled, setSmartConfigEnabled] = useState(false);
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [batchSize, setBatchSize] = useState(50);
  const [autoRetryFailed, setAutoRetryFailed] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);

  // Subject and From rotation - RESTORED
  const [subjectVariations, setSubjectVariations] = useState<string[]>([]);
  const [fromNameVariations, setFromNameVariations] = useState<string[]>([]);

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
          
          // Advanced sending configuration
          sendingMode,
          useTestAfter,
          testAfterEmail,
          testAfterCount,
          trackingEnabled,
          
          // Rotation settings - RESTORED
          useFromRotation,
          useSubjectRotation,
          fromNameVariations: useFromRotation ? fromNameVariations : [],
          subjectVariations: useSubjectRotation ? subjectVariations : [],
          
          // Smart config - RESTORED
          smartConfigEnabled,
          delayBetweenEmails: smartConfigEnabled ? delayBetweenEmails : 2000,
          batchSize: smartConfigEnabled ? batchSize : 50,
          autoRetryFailed,
          maxRetries,
          
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
          {/* Basic Campaign Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Your email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Recipients */}
          <div>
            <Label htmlFor="recipients">
              Recipients 
              {recipientCount > 0 && <Badge variant="secondary" className="ml-2">{recipientCount} emails</Badge>}
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

          <Separator />

          {/* Send Method Selection */}
          <CampaignSendMethodSelector
            selectedMethod={sendMethod}
            onMethodChange={setSendMethod}
            selectedPowerMTAServer={selectedPowerMTAServer}
            onPowerMTAServerChange={setSelectedPowerMTAServer}
          />

          <Separator />

          {/* Account Selection */}
          <CompactAccountSelector
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />

          <Separator />

          {/* Email Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Email Content</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="w-4 h-4 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>
            </div>

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
          </div>

          {/* Advanced Configuration - ALL FEATURES RESTORED */}
          {showAdvanced && (
            <>
              <Separator />
              
              {/* Rotation Configuration - RESTORED */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Content Rotation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>From Name Rotation</Label>
                        <input
                          type="checkbox"
                          checked={useFromRotation}
                          onChange={(e) => setUseFromRotation(e.target.checked)}
                          className="rounded"
                        />
                      </div>
                      {useFromRotation && (
                        <Textarea
                          placeholder="Enter from name variations (one per line)"
                          value={fromNameVariations.join('\n')}
                          onChange={(e) => handleFromNameVariationsChange(e.target.value)}
                          rows={3}
                        />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Subject Rotation</Label>
                        <input
                          type="checkbox"
                          checked={useSubjectRotation}
                          onChange={(e) => setUseSubjectRotation(e.target.checked)}
                          className="rounded"
                        />
                      </div>
                      {useSubjectRotation && (
                        <Textarea
                          placeholder="Enter subject variations (one per line)"
                          value={subjectVariations.join('\n')}
                          onChange={(e) => handleSubjectVariationsChange(e.target.value)}
                          rows={3}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Smart Config - RESTORED */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Smart Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable Smart Config</Label>
                    <input
                      type="checkbox"
                      checked={smartConfigEnabled}
                      onChange={(e) => setSmartConfigEnabled(e.target.checked)}
                      className="rounded"
                    />
                  </div>
                  
                  {smartConfigEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Delay Between Emails (ms)</Label>
                        <Input
                          type="number"
                          value={delayBetweenEmails}
                          onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value) || 2000)}
                          min="100"
                          max="30000"
                        />
                      </div>
                      <div>
                        <Label>Batch Size</Label>
                        <Input
                          type="number"
                          value={batchSize}
                          onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                          min="1"
                          max="1000"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Auto Retry Failed</Label>
                        <input
                          type="checkbox"
                          checked={autoRetryFailed}
                          onChange={(e) => setAutoRetryFailed(e.target.checked)}
                          className="rounded"
                        />
                      </div>
                      <div>
                        <Label>Max Retries</Label>
                        <Input
                          type="number"
                          value={maxRetries}
                          onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                          min="1"
                          max="10"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Standard Advanced Configuration */}
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
                estimatedTime={getEstimatedTime()}
              />
            </>
          )}

          <Separator />

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
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
