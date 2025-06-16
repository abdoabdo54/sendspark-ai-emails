import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, Send, Users, Bot, Server, 
  History, X, Zap, Settings, Clock, RotateCcw, Layers, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import CompactAccountSelector from './CompactAccountSelector';
import TestAfterSection from './TestAfterSection';
import CampaignHistory from './CampaignHistory';

interface CampaignComposerProps {
  onSend: (data: any) => void;
}

const CampaignComposer: React.FC<CampaignComposerProps> = ({ onSend }) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  const { servers: powerMTAServers, loading: serversLoading } = usePowerMTAServers(currentOrganization?.id);
  const { campaigns, loading: campaignsLoading } = useCampaigns(currentOrganization?.id);

  // Form state
  const [fromRotation, setFromRotation] = useState([{ name: '', email: '' }]);
  const [subjectRotation, setSubjectRotation] = useState(['']);
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sendMethod, setSendMethod] = useState('smtp');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState('');
  
  // Advanced features state
  const [useTestAfter, setUseTestAfter] = useState(false);
  const [testAfterEmail, setTestAfterEmail] = useState('');
  const [testAfterCount, setTestAfterCount] = useState(100);
  const [useScheduling, setUseScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [useTracking, setUseTracking] = useState(true);
  const [usePersonalization, setUsePersonalization] = useState(false);
  const [rateLimit, setRateLimit] = useState(50);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(300);
  
  // Smart Config state
  const [smartConfigEnabled, setSmartConfigEnabled] = useState(false);
  const [useManualOverride, setUseManualOverride] = useState(false);
  const [functionsToUse, setFunctionsToUse] = useState(1);
  const [accountsToUse, setAccountsToUse] = useState(0);
  const [smartOptimization, setSmartOptimization] = useState({
    accountLoadBalancing: true,
    deliveryOptimization: true,
    rateLimitAdjustment: true,
    failoverProtection: true
  });

  // PowerMTA monitoring state
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  // Sending Configuration state - FULLY UPGRADED ⚡
  const [sendingMode, setSendingMode] = useState('controlled');
  const [dispatchMethod, setDispatchMethod] = useState('round_robin');

  const activeAccounts = accounts.filter(account => account.is_active);
  const smtpAccounts = activeAccounts.filter(acc => acc.type === 'smtp');
  const appsScriptAccounts = activeAccounts.filter(acc => acc.type === 'apps-script');
  const activePowerMTAServers = powerMTAServers.filter(server => server.is_active);

  // Sending modes configuration
  const sendingModes = [
    {
      value: 'controlled',
      label: 'Controlled (2s delay)',
      description: 'Safe sending with 2 second delays between emails',
      icon: Clock,
      color: 'blue'
    },
    {
      value: 'fast',
      label: 'Fast (0.5s delay)',
      description: 'Faster sending with minimal delays',
      icon: Send,
      color: 'green'
    },
    {
      value: 'zero_delay',
      label: 'Zero Delay (Max Speed) ⚡',
      description: 'Maximum speed with no rate limits or timeouts',
      icon: Zap,
      color: 'red'
    }
  ];

  const dispatchMethods = [
    {
      value: 'parallel',
      label: 'Parallel (All functions) 🚀',
      description: 'Use all available functions simultaneously for maximum throughput',
      icon: Layers,
      color: 'purple'
    },
    {
      value: 'round_robin',
      label: 'Round Robin (Rotate accounts)',
      description: 'Rotate between accounts for balanced distribution',
      icon: RotateCcw,
      color: 'blue'
    },
    {
      value: 'sequential',
      label: 'Sequential',
      description: 'Send emails one by one in sequence',
      icon: Send,
      color: 'gray'
    }
  ];

  const selectedMode = sendingModes.find(mode => mode.value === sendingMode);
  const selectedDispatch = dispatchMethods.find(method => method.value === dispatchMethod);

  // Navigation handlers
  const handleFunctionsClick = () => {
    navigate('/function-manager');
  };

  const handleAccountsClick = () => {
    navigate('/settings');
  };

  const handleSmartConfigClick = () => {
    navigate('/smart-config');
  };

  // Account selection handlers
  const handleSelectAllAccounts = () => {
    const allAccountIds = activeAccounts.map(acc => acc.id);
    setSelectedAccounts(allAccountIds);
    setAccountsToUse(allAccountIds.length);
  };

  const handleDeselectAllAccounts = () => {
    setSelectedAccounts([]);
    setAccountsToUse(0);
  };

  const handleAccountsChange = (accountIds: string[]) => {
    setSelectedAccounts(accountIds);
    setAccountsToUse(accountIds.length);
  };

  // From/Subject rotation handlers
  const addFromEmail = () => {
    setFromRotation([...fromRotation, { name: '', email: '' }]);
  };

  const removeFromEmail = (index: number) => {
    if (fromRotation.length > 1) {
      setFromRotation(fromRotation.filter((_, i) => i !== index));
    }
  };

  const updateFromEmail = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...fromRotation];
    updated[index][field] = value;
    setFromRotation(updated);
  };

  const addSubject = () => {
    setSubjectRotation([...subjectRotation, '']);
  };

  const removeSubject = (index: number) => {
    if (subjectRotation.length > 1) {
      setSubjectRotation(subjectRotation.filter((_, i) => i !== index));
    }
  };

  const updateSubject = (index: number, value: string) => {
    const updated = [...subjectRotation];
    updated[index] = value;
    setSubjectRotation(updated);
  };

  // Form submission - FIXED VALIDATION LOGIC
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipients.trim()) {
      toast.error('Please enter recipients');
      return;
    }

    // Fixed validation: Only check for PowerMTA server if send method is specifically 'powermta'
    if (sendMethod === 'powermta' && !selectedPowerMTAServer) {
      toast.error('Please select a PowerMTA server');
      return;
    }

    // Only check for email accounts if send method is NOT PowerMTA
    if (sendMethod !== 'powermta' && selectedAccounts.length === 0) {
      toast.error('Please select at least one email account');
      return;
    }

    const campaignData = {
      from_rotation: fromRotation,
      subject_rotation: subjectRotation,
      recipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: sendMethod,
      selected_accounts: selectedAccounts,
      selected_powermta_server: selectedPowerMTAServer,
      config: {
        use_test_after: useTestAfter,
        test_after_email: testAfterEmail,
        test_after_count: testAfterCount,
        use_scheduling: useScheduling,
        scheduled_date: scheduledDate,
        use_tracking: useTracking,
        use_personalization: usePersonalization,
        rate_limit: sendingMode === 'zero_delay' ? 0 : (sendingMode === 'fast' ? 100 : rateLimit),
        max_retries: maxRetries,
        retry_delay: sendingMode === 'zero_delay' ? 0 : (sendingMode === 'fast' ? 100 : retryDelay),
        smart_config_enabled: smartConfigEnabled,
        use_manual_override: useManualOverride,
        functions_to_use: functionsToUse,
        accounts_to_use: accountsToUse,
        smart_optimization: smartOptimization,
        monitoring_enabled: monitoringEnabled,
        sending_mode: sendingMode,
        dispatch_method: dispatchMethod
      }
    };

    await onSend(campaignData);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Composer - FULLY UPGRADED ⚡</h1>
          <p className="text-gray-600 mt-1">Create and send professional email campaigns with advanced features and ultimate control</p>
        </div>
        
        {/* Quick Access Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={handleFunctionsClick}
            className="flex items-center gap-2"
          >
            <Bot className="w-4 h-4" />
            Functions
          </Button>
          <Button 
            variant="outline" 
            onClick={handleAccountsClick}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Accounts
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSmartConfigClick}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Smart Config
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Compose - FULLY UPGRADED ⚡
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Campaign History
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Account Selection */}
            <CompactAccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={handleAccountsChange}
              onSelectAll={handleSelectAllAccounts}
              onDeselectAll={handleDeselectAllAccounts}
            />

            {/* Smart Configuration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Smart Configuration - FULLY UPGRADED ⚡
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Smart Configuration</Label>
                    <p className="text-sm text-gray-600">Automatically optimize account usage and delivery performance</p>
                  </div>
                  <Switch checked={smartConfigEnabled} onCheckedChange={setSmartConfigEnabled} />
                </div>

                {smartConfigEnabled && (
                  <>
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Functions to Use</Label>
                        <Input
                          type="number"
                          value={functionsToUse}
                          onChange={(e) => setFunctionsToUse(parseInt(e.target.value) || 1)}
                          min="1"
                          max="10"
                        />
                      </div>
                      <div>
                        <Label>Accounts to Use</Label>
                        <Input
                          type="number"
                          value={accountsToUse}
                          onChange={(e) => setAccountsToUse(parseInt(e.target.value) || 0)}
                          min="0"
                          max={activeAccounts.length}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-medium">Smart Optimization Features</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between">
                          <Label>Account Load Balancing</Label>
                          <Switch 
                            checked={smartOptimization.accountLoadBalancing}
                            onCheckedChange={(checked) => 
                              setSmartOptimization(prev => ({ ...prev, accountLoadBalancing: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Delivery Optimization</Label>
                          <Switch 
                            checked={smartOptimization.deliveryOptimization}
                            onCheckedChange={(checked) => 
                              setSmartOptimization(prev => ({ ...prev, deliveryOptimization: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Rate Limit Adjustment</Label>
                          <Switch 
                            checked={smartOptimization.rateLimitAdjustment}
                            onCheckedChange={(checked) => 
                              setSmartOptimization(prev => ({ ...prev, rateLimitAdjustment: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Failover Protection</Label>
                          <Switch 
                            checked={smartOptimization.failoverProtection}
                            onCheckedChange={(checked) => 
                              setSmartOptimization(prev => ({ ...prev, failoverProtection: checked }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sending Configuration - FULLY UPGRADED ⚡ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Sending Configuration - FULLY UPGRADED ⚡
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Sending Mode Selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Sending Mode</Label>
                    <p className="text-sm text-gray-600 mb-3">Control the speed and rate of email delivery</p>
                  </div>
                  
                  <Select value={sendingMode} onValueChange={setSendingMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select sending mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {sendingModes.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          <div className="flex items-center gap-2">
                            <mode.icon className={`w-4 h-4 text-${mode.color}-600`} />
                            <span>{mode.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedMode && (
                    <div className="p-3 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <selectedMode.icon className={`w-4 h-4 text-${selectedMode.color}-600`} />
                        <span className="font-medium">{selectedMode.label}</span>
                        <Badge variant="outline" className={`text-${selectedMode.color}-600`}>
                          {selectedMode.value === 'zero_delay' ? 'EXTREME' : 
                           selectedMode.value === 'fast' ? 'FAST' : 'SAFE'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{selectedMode.description}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Dispatch Method Selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Dispatch Method</Label>
                    <p className="text-sm text-gray-600 mb-3">Choose how to distribute emails across functions and accounts</p>
                  </div>
                  
                  <Select value={dispatchMethod} onValueChange={setDispatchMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select dispatch method" />
                    </SelectTrigger>
                    <SelectContent>
                      {dispatchMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex items-center gap-2">
                            <method.icon className={`w-4 h-4 text-${method.color}-600`} />
                            <span>{method.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedDispatch && (
                    <div className="p-3 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <selectedDispatch.icon className={`w-4 h-4 text-${selectedDispatch.color}-600`} />
                        <span className="font-medium">{selectedDispatch.label}</span>
                        <Badge variant="outline" className={`text-${selectedDispatch.color}-600`}>
                          {selectedDispatch.value === 'parallel' ? 'MAX POWER' : 
                           selectedDispatch.value === 'round_robin' ? 'BALANCED' : 'SEQUENTIAL'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{selectedDispatch.description}</p>
                    </div>
                  )}
                </div>

                {/* Performance Warnings */}
                {sendingMode === 'zero_delay' && (
                  <Alert className="border-red-200 bg-red-50">
                    <Zap className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>⚡ EXTREME MODE:</strong> Zero Delay mode removes ALL rate limits and timeouts for maximum speed. 
                      Use with caution and ensure your email providers can handle high-volume sending.
                    </AlertDescription>
                  </Alert>
                )}

                {sendingMode === 'zero_delay' && dispatchMethod === 'parallel' && (
                  <Alert className="border-purple-200 bg-purple-50">
                    <Layers className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-purple-800">
                      <strong>🚀 MAXIMUM POWER MODE:</strong> You've selected the most aggressive configuration possible. 
                      This will use all functions in parallel with zero delays for unprecedented sending speed.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Configuration Summary */}
                <div className="p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Sending Mode:</span>
                      <span className="font-medium">{selectedMode?.label || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dispatch Method:</span>
                      <span className="font-medium">{selectedDispatch?.label || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Performance Level:</span>
                      <span className="font-medium">
                        {sendingMode === 'zero_delay' && dispatchMethod === 'parallel' ? '🚀 EXTREME' :
                         sendingMode === 'zero_delay' ? '⚡ VERY HIGH' :
                         sendingMode === 'fast' ? '🔥 HIGH' : '✅ SAFE'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PowerMTA Monitoring - Only show when PowerMTA is selected */}
            {sendMethod === 'powermta' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    PowerMTA Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Real-time Monitoring</Label>
                      <p className="text-sm text-gray-600">Monitor PowerMTA performance in real-time</p>
                    </div>
                    <Switch checked={monitoringEnabled} onCheckedChange={setMonitoringEnabled} />
                  </div>

                  <div>
                    <Label htmlFor="powerMTAServer">Select PowerMTA Server</Label>
                    <Select value={selectedPowerMTAServer} onValueChange={setSelectedPowerMTAServer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select PowerMTA server" />
                      </SelectTrigger>
                      <SelectContent>
                        {activePowerMTAServers.map((server) => (
                          <SelectItem key={server.id} value={server.id}>
                            {server.name || 'Unnamed Server'} ({server.server_host || 'No Host'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* From Email Rotation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  From Email Rotation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fromRotation.map((from, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <Input
                      placeholder="Sender Name"
                      value={from.name}
                      onChange={(e) => updateFromEmail(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="sender@example.com"
                      type="email"
                      value={from.email}
                      onChange={(e) => updateFromEmail(index, 'email', e.target.value)}
                      className="flex-1"
                    />
                    {fromRotation.length > 1 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeFromEmail(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addFromEmail}>
                  Add From Email
                </Button>
              </CardContent>
            </Card>

            {/* Subject Rotation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Subject Line Rotation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjectRotation.map((subject, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <Input
                      placeholder="Subject line..."
                      value={subject}
                      onChange={(e) => updateSubject(index, e.target.value)}
                      className="flex-1"
                    />
                    {subjectRotation.length > 1 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeSubject(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addSubject}>
                  Add Subject Variation
                </Button>
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter email addresses separated by commas or new lines..."
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  rows={6}
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* Email Content */}
            <Card>
              <CardHeader>
                <CardTitle>Email Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="htmlContent">HTML Content</Label>
                  <Textarea
                    id="htmlContent"
                    placeholder="Enter your HTML email content..."
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    rows={8}
                  />
                </div>
                <div>
                  <Label htmlFor="textContent">Plain Text Content (Fallback)</Label>
                  <Textarea
                    id="textContent"
                    placeholder="Enter plain text version..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={6}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sending Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Sending Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sendMethod">Send Method</Label>
                  <Select value={sendMethod} onValueChange={setSendMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP ({smtpAccounts.length} accounts)</SelectItem>
                      <SelectItem value="apps-script">Apps Script ({appsScriptAccounts.length} accounts)</SelectItem>
                      <SelectItem value="powermta">PowerMTA ({activePowerMTAServers.length} servers)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Features */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Test After Configuration */}
                <TestAfterSection
                  useTestAfter={useTestAfter}
                  onUseTestAfterChange={setUseTestAfter}
                  testAfterEmail={testAfterEmail}
                  onTestAfterEmailChange={setTestAfterEmail}
                  testAfterCount={testAfterCount}
                  onTestAfterCountChange={setTestAfterCount}
                />

                <Separator />

                {/* Scheduling */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Schedule Campaign</Label>
                    <p className="text-sm text-gray-600">Send at a specific date and time</p>
                  </div>
                  <Switch checked={useScheduling} onCheckedChange={setUseScheduling} />
                </div>
                {useScheduling && (
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                )}

                <Separator />

                {/* Tracking and Analytics */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Tracking</Label>
                    <p className="text-sm text-gray-600">Track opens, clicks, and engagement</p>
                  </div>
                  <Switch checked={useTracking} onCheckedChange={setUseTracking} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Personalization</Label>
                    <p className="text-sm text-gray-600">Use dynamic tags like {"{"}{"{"}{"}"}name{"}"}{"}"}</p>
                  </div>
                  <Switch checked={usePersonalization} onCheckedChange={setUsePersonalization} />
                </div>

                <Separator />

                {/* Rate Limiting - Only show if not in zero delay mode */}
                {sendingMode !== 'zero_delay' && (
                  <>
                    <div>
                      <Label>Rate Limit (emails per hour)</Label>
                      <Input
                        type="number"
                        value={rateLimit}
                        onChange={(e) => setRateLimit(parseInt(e.target.value) || 50)}
                        min="1"
                        max="1000"
                      />
                    </div>

                    {/* Retry Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Max Retries</Label>
                        <Input
                          type="number"
                          value={maxRetries}
                          onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                          min="0"
                          max="10"
                        />
                      </div>
                      <div>
                        <Label>Retry Delay (seconds)</Label>
                        <Input
                          type="number"
                          value={retryDelay}
                          onChange={(e) => setRetryDelay(parseInt(e.target.value) || 300)}
                          min="60"
                          max="3600"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button type="submit" size="lg" className="px-8">
                <Send className="w-5 h-5 mr-2" />
                Create Campaign
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <CampaignHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CampaignComposer;
