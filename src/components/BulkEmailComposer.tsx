
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
import { Send, Loader2, Settings, Zap, Server, Cloud, Target, Upload, TestTube } from 'lucide-react';
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

  // Dispatch Method
  const [dispatchMethod, setDispatchMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState<string>('');

  // Sending Configuration
  const [sendingMode, setSendingMode] = useState<'controlled' | 'fast' | 'zero-delay'>('controlled');
  
  // Rotation Settings
  const [useFromRotation, setUseFromRotation] = useState(false);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [fromNameVariations, setFromNameVariations] = useState<string[]>([]);
  const [subjectVariations, setSubjectVariations] = useState<string[]>([]);

  // Advanced Settings
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
    if (dispatchMethod === 'powermta' && activeServers.length > 0 && !selectedPowerMTAServer) {
      setSelectedPowerMTAServer(activeServers[0].id);
    }
  }, [dispatchMethod, activeServers, selectedPowerMTAServer]);

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

  const handleSend = async () => {
    if (!fromName || !subject || !recipients) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one email account');
      return;
    }

    if (dispatchMethod === 'powermta' && !selectedPowerMTAServer) {
      toast.error('Please select a PowerMTA server');
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
        send_method: dispatchMethod,
        config: {
          selectedAccounts,
          dispatchMethod,
          selectedPowerMTAServer: dispatchMethod === 'powermta' ? selectedPowerMTAServer : null,
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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaign Management Center</h1>
        <p className="text-gray-600">Create, configure, and manage professional email campaigns with advanced features</p>
      </div>

      {/* Create Email Campaign */}
      <Card>
        <CardHeader className="bg-blue-50 rounded-t-lg">
          <CardTitle className="flex items-center text-blue-900">
            <Send className="w-5 h-5 mr-2" />
            Create Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Step Navigation */}
          <div className="grid grid-cols-3 gap-4">
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
              📧 Email/List ({recipientCount})
            </Button>
            <Button variant="outline">
              👤 Account ({selectedAccounts.length})
            </Button>
            <Button variant="outline">
              📤 Send/Config
            </Button>
          </div>

          {/* Smart Configuration Engine */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                id="smartConfig"
                checked={false}
                onChange={() => {}}
                className="w-4 h-4"
              />
              <Label htmlFor="smartConfig" className="font-medium">Use Manual Configuration Override</Label>
              {recipientCount > 0 && <Badge variant="secondary">{recipientCount} recipients</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Method */}
      <Card>
        <CardHeader className="bg-orange-50 rounded-t-lg">
          <CardTitle className="flex items-center text-orange-900">
            <Target className="w-5 h-5 mr-2" />
            Dispatch Method
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <Button
              variant={dispatchMethod === 'cloud_functions' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('cloud_functions')}
              className="h-auto p-4 flex flex-col items-center justify-center space-y-2"
              disabled={!hasFunctions}
            >
              <Cloud className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Cloud Functions</div>
                <div className="text-xs opacity-70">{enabledFunctions.length} functions available</div>
              </div>
            </Button>
            
            <Button
              variant={dispatchMethod === 'powermta' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('powermta')}
              className="h-auto p-4 flex flex-col items-center justify-center space-y-2"
              disabled={!hasPowerMTAServers}
            >
              <Server className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">PowerMTA</div>
                <div className="text-xs opacity-70">
                  {hasPowerMTAServers ? `${activeServers.length} servers` : 'Setup Required'}
                </div>
              </div>
            </Button>
          </div>

          {dispatchMethod === 'powermta' && hasPowerMTAServers && (
            <div>
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
        </CardContent>
      </Card>

      {/* Sending Configuration */}
      <Card>
        <CardHeader className="bg-green-50 rounded-t-lg">
          <CardTitle className="flex items-center text-green-900">
            <Settings className="w-5 h-5 mr-2" />
            Sending Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sending Mode */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Sending Mode</Label>
              <div className="space-y-3">
                {[
                  { value: 'controlled', label: 'Controlled (2s delay)', icon: '🕒' },
                  { value: 'fast', label: 'Fast (0.5s delay)', icon: '⚡' },
                  { value: 'zero-delay', label: 'Zero Delay (Max Speed)', icon: '🚀' }
                ].map((mode) => (
                  <div key={mode.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={mode.value}
                      name="sendingMode"
                      value={mode.value}
                      checked={sendingMode === mode.value}
                      onChange={(e) => setSendingMode(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor={mode.value} className="text-sm cursor-pointer">
                      {mode.icon} {mode.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch Method */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Dispatch Method</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={dispatchMethod === 'cloud_functions'}
                    onChange={() => setDispatchMethod('cloud_functions')}
                    className="w-4 h-4"
                  />
                  <Label className="text-sm">☁️ Cloud Functions (recommended)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={dispatchMethod === 'powermta'}
                    onChange={() => setDispatchMethod('powermta')}
                    className="w-4 h-4"
                  />
                  <Label className="text-sm">🖥️ PowerMTA Server Bridge</Label>
                </div>
              </div>
            </div>

            {/* Subject Rotation */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Subject Rotation</Label>
              <Textarea
                placeholder="Subject line variations (one per line)&#10;Rotates automatically"
                value={subjectVariations.join('\n')}
                onChange={(e) => handleSubjectVariationsChange(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
          </div>

          {recipientCount > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mt-4">
              <p className="text-sm text-blue-800">
                ⏱️ Estimated sending time: <strong>{getEstimatedTime()}</strong> for {recipientCount} recipients
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Accounts */}
      <Card>
        <CardHeader className="bg-purple-50 rounded-t-lg">
          <CardTitle className="flex items-center text-purple-900">
            <Settings className="w-5 h-5 mr-2" />
            Email Accounts ({selectedAccounts.length} Selected)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4">
            <Label className="text-sm font-medium mb-2 block">📧 Select accounts:</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
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
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-gray-900">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fromName">From Name *</Label>
              <Input
                id="fromName"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Your Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          {/* Rotation Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">Recipient Rotation</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useFromRotation"
                    checked={useFromRotation}
                    onChange={(e) => setUseFromRotation(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="useFromRotation" className="text-sm">🔄 Use automatic sender name rotation</Label>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Subject Rotation</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useSubjectRotation"
                    checked={useSubjectRotation}
                    onChange={(e) => setUseSubjectRotation(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="useSubjectRotation" className="text-sm">📝 Rotate email subjects automatically</Label>
                </div>
              </div>
            </div>
          </div>

          {/* From Name Rotation */}
          {useFromRotation && (
            <div>
              <Label>From Name Rotation</Label>
              <Textarea
                placeholder="Enter from name variations (one per line)&#10;Example:&#10;John Smith&#10;John S.&#10;J. Smith"
                value={fromNameVariations.join('\n')}
                onChange={(e) => handleFromNameVariationsChange(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* CSV Import */}
          <div>
            <Label>Import Recipients from CSV File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="mb-4">
                <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Upload a CSV file with recipient information. First row should contain headers, additional columns are supported
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  📄 Choose CSV File
                </Button>
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <Label>Recipients *</Label>
            <Textarea
              placeholder="Enter email addresses (one per line or comma-separated)&#10;example@domain.com&#10;test@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              rows={5}
            />
            {recipientCount > 0 && (
              <div className="mt-2">
                <Badge variant="secondary">{recipientCount} recipients</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* HTML Content */}
      <Card>
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-gray-900">HTML Content *</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="trackingEnabled"
                checked={trackingEnabled}
                onChange={(e) => setTrackingEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="trackingEnabled" className="text-sm">📊 Enable click tracking, open tracking, and unsubscribe functionality for emails</Label>
            </div>
          </div>
          <Textarea
            placeholder="<h1>HTML content here...</h1>&#10;<p>Your email content goes here...</p>"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={12}
          />
        </CardContent>
      </Card>

      {/* Plain Text Content */}
      <Card>
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-gray-900">Plain Text Content</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            placeholder="Your plain text email content here...&#10;This is optional but recommended for better deliverability."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={8}
          />
        </CardContent>
      </Card>

      {/* Send Test Email After X Emails Method */}
      <Card>
        <CardHeader className="bg-yellow-50 rounded-t-lg">
          <CardTitle className="flex items-center text-yellow-900">
            <TestTube className="w-5 h-5 mr-2" />
            Send Test Email After X Emails Method
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  id="useTestAfter"
                  checked={useTestAfter}
                  onChange={(e) => setUseTestAfter(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="useTestAfter" className="text-sm font-medium">Test After X Emails</Label>
              </div>
              <Input
                placeholder="test@email.com"
                value={testAfterEmail}
                onChange={(e) => setTestAfterEmail(e.target.value)}
                disabled={!useTestAfter}
              />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-3">Send Every X Emails</Label>
              <Input
                type="number"
                placeholder="10"
                value={testAfterCount}
                onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 10)}
                disabled={!useTestAfter}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft Testing */}
      <Card className="border-yellow-300 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-yellow-900">⚠️ Draft Testing - Use Central Accounts</h3>
              <p className="text-sm text-yellow-700 mt-1">Test your campaign before sending to all recipients</p>
            </div>
            <Button variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100">
              🧪 Test Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Campaign Button */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="text-center">
          <p className="text-white mb-4 text-lg">
            After creating, see <strong>Campaign History</strong> to prepare and send your email.
          </p>
          <Button
            onClick={handleSend}
            disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0 || (dispatchMethod === 'powermta' && !selectedPowerMTAServer)}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 min-w-[300px] h-12"
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Creating Campaign...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Create Campaign Draft
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkEmailComposer;
