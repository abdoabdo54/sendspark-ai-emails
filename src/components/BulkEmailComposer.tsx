
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Send, Loader2, Settings, Server, Cloud, Target, Upload, TestTube } from 'lucide-react';
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
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Email Campaign</h1>
        <p className="text-gray-600">Configure and send bulk email campaigns</p>
      </div>

      {/* Campaign Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Campaign Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sending Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sending Mode</Label>
              <div className="space-y-2">
                {[
                  { value: 'controlled', label: 'Controlled (2s delay)', icon: '🕒' },
                  { value: 'fast', label: 'Fast (0.5s delay)', icon: '⚡' },
                  { value: 'zero-delay', label: 'Zero Delay (Max Speed)', icon: '🚀' }
                ].map((mode) => (
                  <label key={mode.value} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="sendingMode"
                      value={mode.value}
                      checked={sendingMode === mode.value}
                      onChange={(e) => setSendingMode(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{mode.icon} {mode.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Advanced Options</Label>
              <div className="space-y-3">
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
            </div>
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

      {/* Dispatch Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Dispatch Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Button
              variant={dispatchMethod === 'cloud_functions' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('cloud_functions')}
              className="h-20 flex flex-col items-center justify-center space-y-2"
              disabled={!hasFunctions}
            >
              <Cloud className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">Cloud Functions</div>
                <div className="text-xs opacity-75">{enabledFunctions.length} functions available</div>
              </div>
            </Button>
            
            <Button
              variant={dispatchMethod === 'powermta' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('powermta')}
              className="h-20 flex flex-col items-center justify-center space-y-2"
              disabled={!hasPowerMTAServers}
            >
              <Server className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">PowerMTA</div>
                <div className="text-xs opacity-75">
                  {hasPowerMTAServers ? `${activeServers.length} servers` : 'Setup Required'}
                </div>
              </div>
            </Button>
          </div>

          {dispatchMethod === 'powermta' && hasPowerMTAServers && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select PowerMTA Server:</Label>
              <div className="space-y-2">
                {activeServers.map((server) => (
                  <Button
                    key={server.id}
                    variant={selectedPowerMTAServer === server.id ? 'default' : 'outline'}
                    onClick={() => setSelectedPowerMTAServer(server.id)}
                    className="w-full justify-start h-auto p-3"
                  >
                    <Server className="w-4 h-4 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">{server.name}</div>
                      <div className="text-xs opacity-75">{server.server_host}</div>
                    </div>
                  </Button>
                ))}
              </div>
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
          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name *</Label>
              <Input
                id="fromName"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Your Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
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
          disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0 || (dispatchMethod === 'powermta' && !selectedPowerMTAServer)}
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
