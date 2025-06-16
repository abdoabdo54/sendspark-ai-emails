
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Send, Loader2, Settings, Server, Cloud, Target, Upload, TestTube, Zap, Users, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  // Send Method Selection
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState<string>('');

  // Manual Configuration Override
  const [useManualOverride, setUseManualOverride] = useState(false);

  // Dispatch Method and Sending Configuration
  const [dispatchMethod, setDispatchMethod] = useState<'parallel' | 'round_robin' | 'sequential'>('parallel');
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');

  // Rotation Settings (moved to campaign details)
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [fromNameVariations, setFromNameVariations] = useState<string[]>([]);
  const [subjectVariations, setSubjectVariations] = useState<string[]>([]);

  // Other Advanced Settings
  const [useTestAfter, setUseTestAfter] = useState(false);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(10);
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  const recipientCount = recipients.split('\n').filter(email => email.trim()).length;
  const activeAccounts = accounts.filter(account => account.is_active);
  const enabledFunctions = functions.filter(func => func.enabled);
  const activeServers = servers.filter(server => server.is_active);
  const hasFunctions = enabledFunctions.length > 0;
  const hasPowerMTAServers = activeServers.length > 0;

  // Auto-select first PowerMTA server when switching to PowerMTA method
  useEffect(() => {
    if (sendMethod === 'powermta' && activeServers.length > 0 && !selectedPowerMTAServer) {
      setSelectedPowerMTAServer(activeServers[0].id);
    }
  }, [sendMethod, activeServers, selectedPowerMTAServer]);

  const handleSubjectVariationsChange = (value: string) => {
    const variations = value.split('\n').filter(line => line.trim());
    setSubjectVariations(variations);
  };

  const handleFromNameVariationsChange = (value: string) => {
    const variations = value.split('\n').filter(line => line.trim());
    setFromNameVariations(variations);
  };

  const getEstimatedTime = () => {
    if (recipientCount === 0) return '';
    
    const delays = {
      'controlled': 2000,
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

  const handleNavigateToFunctions = () => {
    navigate('/function-manager');
  };

  const handleNavigateToAccounts = () => {
    navigate('/');
  };

  const handleNavigateToSmartConfig = () => {
    navigate('/smart-config');
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
        send_method: sendMethod === 'powermta' ? 'sequential' : dispatchMethod,
        config: {
          selectedAccounts,
          sendMethod,
          dispatchMethod,
          selectedPowerMTAServer: sendMethod === 'powermta' ? selectedPowerMTAServer : null,
          useFromRotation,
          useSubjectRotation,
          fromNameVariations: useFromRotation ? fromNameVariations : [],
          subjectVariations: useSubjectRotation ? subjectVariations : [],
          sendingMode,
          useTestAfter,
          testAfterEmail,
          testAfterCount,
          trackingEnabled,
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
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📧 Create Email Campaign</h1>
        <p className="text-gray-600">Configure and send bulk email campaigns</p>
      </div>

      {/* Send Method Selection */}
      <CampaignSendMethodSelector
        selectedMethod={sendMethod}
        onMethodChange={setSendMethod}
        selectedPowerMTAServer={selectedPowerMTAServer}
        onPowerMTAServerChange={setSelectedPowerMTAServer}
      />

      {/* Navigation Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleNavigateToFunctions}
              className="flex items-center gap-2 px-4 py-2 border-2 hover:bg-gray-50"
            >
              <Zap className="w-4 h-4" />
              Functions ({enabledFunctions.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={handleNavigateToAccounts}
              className="flex items-center gap-2 px-4 py-2 border-2 hover:bg-gray-50"
            >
              <Users className="w-4 h-4" />
              Accounts ({activeAccounts.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={handleNavigateToSmartConfig}
              className="flex items-center gap-2 px-4 py-2 border-2 hover:bg-gray-50"
            >
              <Wrench className="w-4 h-4" />
              SmartConfig
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Smart Configuration Engine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Smart Configuration Engine - FULLY UPGRADED
            <Zap className="w-4 h-4 text-orange-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Use Manual Configuration Override</Label>
            <Switch 
              checked={useManualOverride}
              onCheckedChange={setUseManualOverride}
            />
          </div>
          
          {useManualOverride && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Manual Override Configuration</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-blue-700 mb-2 block">Functions to Use</Label>
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <div className="text-2xl font-bold text-center mb-1">1</div>
                    <div className="text-xs text-blue-600 text-center">Available: {enabledFunctions.length} functions</div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-blue-700 mb-2 block">Accounts to Use</Label>
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <div className="text-2xl font-bold text-center mb-1">1</div>
                    <div className="text-xs text-blue-600 text-center">Selected: {selectedAccounts.length} accounts</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sending Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Sending Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sending Mode */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sending Mode</Label>
              <RadioGroup value={sendingMode} onValueChange={(value: any) => setSendingMode(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="controlled" id="controlled" />
                  <Label htmlFor="controlled" className="text-sm">🕒 Controlled (2s delay)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fast" id="fast" />
                  <Label htmlFor="fast" className="text-sm">⚡ Fast (0.5s delay)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="zero-delay" id="zero-delay" />
                  <Label htmlFor="zero-delay" className="text-sm">🚀 Zero Delay (Max Speed)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dispatch Method - Only show for Cloud Functions */}
            {sendMethod === 'cloud_functions' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Dispatch Method</Label>
                <RadioGroup value={dispatchMethod} onValueChange={(value: any) => setDispatchMethod(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parallel" id="parallel" />
                    <Label htmlFor="parallel" className="text-sm">🚀 Parallel (All functions)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="round_robin" id="round_robin" />
                    <Label htmlFor="round_robin" className="text-sm">Round Robin (Rotate accounts)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sequential" id="sequential" />
                    <Label htmlFor="sequential" className="text-sm">Sequential</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Current Selection Display */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Current Selection:</span>
            </div>
            <p className="text-blue-700 text-sm">
              {sendingMode === 'zero-delay' ? 'Zero Delay (Max Speed)' : 
               sendingMode === 'fast' ? 'Fast (0.5s delay)' : 'Controlled (2s delay)'} + {' '}
              {sendMethod === 'powermta' ? 'PowerMTA Sequential' :
               dispatchMethod === 'parallel' ? 'Parallel (All functions)' :
               dispatchMethod === 'round_robin' ? 'Round Robin (Rotate accounts)' : 'Sequential'}
            </p>
          </div>

          {recipientCount > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-800 text-sm">
                ⏱️ Estimated sending time: <span className="font-medium">{getEstimatedTime()}</span> for {recipientCount} recipients
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Email Accounts ({selectedAccounts.length} Selected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex gap-3 mb-4">
              <Button 
                variant="outline" 
                onClick={handleSelectAll}
                size="sm"
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeselectAll}
                size="sm"
              >
                Deselect All
              </Button>
            </div>
          </div>
          <CompactAccountSelector
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Fields with Rotation Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name *</Label>
                <Input
                  id="fromName"
                  placeholder="Your Name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              
              {/* From Name Rotation */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">From Name Rotation</div>
                  <div className="text-xs text-gray-500">Rotate sender names</div>
                </div>
                <Switch
                  checked={useFromRotation}
                  onCheckedChange={setUseFromRotation}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Your Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              
              {/* Subject Rotation */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">Subject Rotation</div>
                  <div className="text-xs text-gray-500">Rotate email subjects</div>
                </div>
                <Switch
                  checked={useSubjectRotation}
                  onCheckedChange={setUseSubjectRotation}
                />
              </div>
            </div>
          </div>

          {/* Rotation Variations */}
          {useFromRotation && (
            <div className="space-y-2">
              <Label>From Name Variations</Label>
              <Textarea
                placeholder="Enter from name variations (one per line)&#10;Example:&#10;John Smith&#10;John S.&#10;J. Smith"
                value={fromNameVariations.join('\n')}
                onChange={(e) => handleFromNameVariationsChange(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {useSubjectRotation && (
            <div className="space-y-2">
              <Label>Subject Variations</Label>
              <Textarea
                placeholder="Subject line variations (one per line)&#10;Rotates automatically"
                value={subjectVariations.join('\n')}
                onChange={(e) => handleSubjectVariationsChange(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* Other Advanced Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-medium">Email Tracking</div>
                <div className="text-xs text-gray-500">Track opens & clicks</div>
              </div>
              <Switch
                checked={trackingEnabled}
                onCheckedChange={setTrackingEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="text-sm font-medium">Test After X Emails</div>
                <div className="text-xs text-gray-500">Send test emails</div>
              </div>
              <Switch
                checked={useTestAfter}
                onCheckedChange={setUseTestAfter}
              />
            </div>
          </div>

          {/* Test After Configuration */}
          {useTestAfter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Test Email Address</Label>
                <Input
                  placeholder="test@email.com"
                  value={testAfterEmail}
                  onChange={(e) => setTestAfterEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Send Every X Emails</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={testAfterCount}
                  onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
          )}

          {/* Recipients */}
          <div className="space-y-2">
            <Label>Recipients *</Label>
            <Textarea
              placeholder="Enter email addresses (one per line or comma-separated)&#10;example@domain.com&#10;test@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              rows={6}
            />
            {recipientCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {recipientCount} recipients
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Recipients from CSV */}
      <Card>
        <CardHeader>
          <CardTitle>Import Recipients from CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">
              Upload a CSV file with recipient information. First row should contain headers.
            </p>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Choose CSV File
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* HTML Content */}
      <Card>
        <CardHeader>
          <CardTitle>HTML Content *</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="<h1>HTML content here...</h1>&#10;<p>Your email content goes here...</p>"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Plain Text Content */}
      <Card>
        <CardHeader>
          <CardTitle>Plain Text Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Your plain text email content here...&#10;This is optional but recommended for better deliverability."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={8}
          />
        </CardContent>
      </Card>

      {/* Draft Testing */}
      <Card className="border-yellow-300 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-yellow-900 mb-1">Draft Testing</h3>
              <p className="text-yellow-700">Test your campaign before sending to all recipients</p>
            </div>
            <Button variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100">
              <TestTube className="w-4 h-4 mr-2" />
              Test Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Campaign Button */}
      <div className="bg-gray-900 p-6 rounded-lg text-center">
        <p className="text-white mb-4">
          After creating, see <strong>Campaign History</strong> to prepare and send your email.
        </p>
        <Button
          onClick={handleSend}
          disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 min-w-[250px]"
        >
          {sending ? (
            <>
              <Loader2 className="animate-spin w-5 h-5 mr-2" />
              Creating Campaign...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Create Campaign Draft
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default BulkEmailComposer;
