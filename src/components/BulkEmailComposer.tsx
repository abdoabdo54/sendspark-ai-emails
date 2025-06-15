
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Send, Loader2, Settings, Zap, Server, Cloud, Target, Upload, TestTube, Calculator } from 'lucide-react';
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

  // Smart Configuration
  const [smartConfigEnabled, setSmartConfigEnabled] = useState(false);
  const [emailVolume, setEmailVolume] = useState(10000);

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

  const handleCalculateOptimalConfig = () => {
    toast.info('Calculating optimal configuration...');
    // Smart config logic would go here
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
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Campaign Management Center
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Create, configure, and manage professional email campaigns with advanced features
        </p>
      </div>

      {/* SmartConfig Engine */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl text-blue-900">
            <Calculator className="w-6 h-6" />
            SmartConfig Engine
          </CardTitle>
          <p className="text-blue-700">Get optimal recommendations for your email campaign</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Campaign Parameters */}
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Settings className="w-5 h-5" />
                Campaign Parameters
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Total Email Volume</Label>
                  <Input
                    type="number"
                    value={emailVolume}
                    onChange={(e) => setEmailVolume(parseInt(e.target.value) || 0)}
                    className="mt-1"
                    placeholder="10000"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Available Resources</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-blue-100 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{enabledFunctions.length}</div>
                      <div className="text-sm text-blue-700">Cloud Functions</div>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{activeAccounts.length}</div>
                      <div className="text-sm text-green-700">Email Accounts</div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleCalculateOptimalConfig}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white py-3"
                >
                  <Calculator className="w-5 h-5 mr-2" />
                  Calculate Optimal Config
                </Button>
              </div>
            </div>

            {/* Smart Recommendations */}
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Zap className="w-5 h-5" />
                Smart Recommendations
              </h3>
              
              <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">
                  Enter email volume and click "Calculate Optimal Config"
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Manage Functions
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Manage Accounts
              </Button>
              <Button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900">
                <Send className="w-4 h-4" />
                Start Campaign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Email Campaign */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl text-purple-900">
            <Send className="w-6 h-6" />
            Create Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* Step Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl mb-2">📧</div>
              <div className="font-medium">Email/List</div>
              <div className="text-sm opacity-90">({recipientCount} recipients)</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <div className="text-2xl mb-2">👤</div>
              <div className="font-medium text-gray-700">Accounts</div>
              <div className="text-sm text-gray-600">({selectedAccounts.length} selected)</div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <div className="text-2xl mb-2">📤</div>
              <div className="font-medium text-gray-700">Send/Config</div>
              <div className="text-sm text-gray-600">(Ready to configure)</div>
            </div>
          </div>

          {/* Manual Configuration Override */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={smartConfigEnabled}
                  onCheckedChange={setSmartConfigEnabled}
                />
                <div>
                  <Label className="text-base font-medium">Use Manual Configuration Override</Label>
                  {recipientCount > 0 && (
                    <div className="mt-1">
                      <Badge variant="secondary">{recipientCount} recipients</Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch Method */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl text-orange-900">
            <Target className="w-6 h-6" />
            Dispatch Method
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Button
              variant={dispatchMethod === 'cloud_functions' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('cloud_functions')}
              className="h-24 flex flex-col items-center justify-center space-y-3 text-base"
              disabled={!hasFunctions}
            >
              <Cloud className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold">Cloud Functions</div>
                <div className="text-sm opacity-75">{enabledFunctions.length} functions available</div>
              </div>
            </Button>
            
            <Button
              variant={dispatchMethod === 'powermta' ? 'default' : 'outline'}
              onClick={() => setDispatchMethod('powermta')}
              className="h-24 flex flex-col items-center justify-center space-y-3 text-base"
              disabled={!hasPowerMTAServers}
            >
              <Server className="w-8 h-8" />
              <div className="text-center">
                <div className="font-semibold">PowerMTA</div>
                <div className="text-sm opacity-75">
                  {hasPowerMTAServers ? `${activeServers.length} servers` : 'Setup Required'}
                </div>
              </div>
            </Button>
          </div>

          {dispatchMethod === 'powermta' && hasPowerMTAServers && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Select PowerMTA Server:</Label>
              <div className="space-y-2">
                {activeServers.map((server) => (
                  <Button
                    key={server.id}
                    variant={selectedPowerMTAServer === server.id ? 'default' : 'outline'}
                    onClick={() => setSelectedPowerMTAServer(server.id)}
                    className="w-full justify-start h-12"
                  >
                    <Server className="w-5 h-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">{server.name}</div>
                      <div className="text-sm opacity-75">{server.server_host}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sending Configuration */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl text-green-900">
            <Settings className="w-6 h-6" />
            Sending Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sending Mode */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Sending Mode</Label>
              <div className="space-y-3">
                {[
                  { value: 'controlled', label: 'Controlled', desc: '2s delay', icon: '🕒' },
                  { value: 'fast', label: 'Fast', desc: '0.5s delay', icon: '⚡' },
                  { value: 'zero-delay', label: 'Zero Delay', desc: 'Max Speed', icon: '🚀' }
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
                    <div className="flex-1">
                      <div className="font-medium">{mode.icon} {mode.label}</div>
                      <div className="text-sm text-gray-600">{mode.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Rotation Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Rotation Settings</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">From Name Rotation</div>
                    <div className="text-sm text-gray-600">Rotate sender names</div>
                  </div>
                  <Switch
                    checked={useFromRotation}
                    onCheckedChange={setUseFromRotation}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Subject Rotation</div>
                    <div className="text-sm text-gray-600">Rotate email subjects</div>
                  </div>
                  <Switch
                    checked={useSubjectRotation}
                    onCheckedChange={setUseSubjectRotation}
                  />
                </div>
              </div>
            </div>

            {/* Advanced Features */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Advanced Features</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Email Tracking</div>
                    <div className="text-sm text-gray-600">Track opens & clicks</div>
                  </div>
                  <Switch
                    checked={trackingEnabled}
                    onCheckedChange={setTrackingEnabled}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Test After X Emails</div>
                    <div className="text-sm text-gray-600">Send test emails</div>
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
            <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-800 font-medium">
                ⏱️ Estimated sending time: <span className="font-bold">{getEstimatedTime()}</span> for {recipientCount} recipients
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Accounts */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl text-purple-900">
            <Target className="w-6 h-6" />
            Email Accounts ({selectedAccounts.length} Selected)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="mb-6">
            <Label className="text-base font-semibold mb-3 block">📧 Select accounts:</Label>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleSelectAll}
                className="flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                Select All
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeselectAll}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
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
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg">
          <CardTitle className="text-xl text-gray-900">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fromName" className="text-base font-medium">From Name *</Label>
              <Input
                id="fromName"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-base font-medium">Subject *</Label>
              <Input
                id="subject"
                placeholder="Your Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          {/* Rotation Variations */}
          {useFromRotation && (
            <div className="space-y-2">
              <Label className="text-base font-medium">From Name Variations</Label>
              <Textarea
                placeholder="Enter from name variations (one per line)&#10;Example:&#10;John Smith&#10;John S.&#10;J. Smith"
                value={fromNameVariations.join('\n')}
                onChange={(e) => handleFromNameVariationsChange(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {useSubjectRotation && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Subject Variations</Label>
              <Textarea
                placeholder="Subject line variations (one per line)&#10;Rotates automatically"
                value={subjectVariations.join('\n')}
                onChange={(e) => handleSubjectVariationsChange(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {/* Test After Configuration */}
          {useTestAfter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Test Email Address</Label>
                <Input
                  placeholder="test@email.com"
                  value={testAfterEmail}
                  onChange={(e) => setTestAfterEmail(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-medium">Send Every X Emails</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={testAfterCount}
                  onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 10)}
                  className="h-12"
                />
              </div>
            </div>
          )}

          {/* CSV Import */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Import Recipients from CSV File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                <Upload className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Upload a CSV file with recipient information. First row should contain headers, additional columns are supported
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Choose CSV File
              </Button>
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Recipients *</Label>
            <Textarea
              placeholder="Enter email addresses (one per line or comma-separated)&#10;example@domain.com&#10;test@company.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              rows={6}
              className="resize-none"
            />
            {recipientCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {recipientCount} recipients
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* HTML Content */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg">
          <CardTitle className="text-xl text-gray-900">HTML Content *</CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <Textarea
            placeholder="<h1>HTML content here...</h1>&#10;<p>Your email content goes here...</p>"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={12}
            className="resize-none font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Plain Text Content */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg">
          <CardTitle className="text-xl text-gray-900">Plain Text Content</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <Textarea
            placeholder="Your plain text email content here...&#10;This is optional but recommended for better deliverability."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={8}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Draft Testing */}
      <Card className="border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-yellow-900 mb-2">⚠️ Draft Testing - Use Central Accounts</h3>
              <p className="text-yellow-700">Test your campaign before sending to all recipients</p>
            </div>
            <Button 
              variant="outline" 
              className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 h-12 px-6"
            >
              <TestTube className="w-5 h-5 mr-2" />
              Test Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Campaign Button */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-8 rounded-lg text-center">
        <p className="text-white mb-6 text-lg">
          After creating, see <strong>Campaign History</strong> to prepare and send your email.
        </p>
        <Button
          onClick={handleSend}
          disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0 || (dispatchMethod === 'powermta' && !selectedPowerMTAServer)}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 min-w-[300px] h-14 text-lg"
        >
          {sending ? (
            <>
              <Loader2 className="animate-spin w-6 h-6 mr-3" />
              Creating Campaign...
            </>
          ) : (
            <>
              <Zap className="w-6 h-6 mr-3" />
              Create Campaign Draft
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default BulkEmailComposer;
