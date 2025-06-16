
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
import { 
  Mail, Send, Users, Bot, Server, 
  TestTube, Calendar, X, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import CompactAccountSelector from './CompactAccountSelector';
import SmartConfigurationPanel from './SmartConfigurationPanel';
import PowerMTAMonitoringPanel from './PowerMTAMonitoringPanel';
import TestAfterSection from './TestAfterSection';

interface CampaignComposerProps {
  onSend: (data: any) => void;
}

const CampaignComposer: React.FC<CampaignComposerProps> = ({ onSend }) => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading } = useEmailAccounts(currentOrganization?.id);
  const { servers: powerMTAServers, loading: serversLoading } = usePowerMTAServers(currentOrganization?.id);

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

  const activeAccounts = accounts.filter(account => account.is_active);
  const smtpAccounts = activeAccounts.filter(acc => acc.type === 'smtp');
  const appsScriptAccounts = activeAccounts.filter(acc => acc.type === 'apps-script');
  const activePowerMTAServers = powerMTAServers.filter(server => server.is_active);

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

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipients.trim()) {
      toast.error('Please enter recipients');
      return;
    }

    if (selectedAccounts.length === 0 && sendMethod !== 'powermta') {
      toast.error('Please select at least one email account');
      return;
    }

    if (sendMethod === 'powermta' && !selectedPowerMTAServer) {
      toast.error('Please select a PowerMTA server');
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
        rate_limit: rateLimit,
        max_retries: maxRetries,
        retry_delay: retryDelay,
        smart_config_enabled: smartConfigEnabled,
        use_manual_override: useManualOverride,
        functions_to_use: functionsToUse,
        accounts_to_use: accountsToUse,
        smart_optimization: smartOptimization,
        monitoring_enabled: monitoringEnabled
      }
    };

    await onSend(campaignData);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Composer</h1>
          <p className="text-gray-600 mt-1">Create and send professional email campaigns with advanced features</p>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="smart-config" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Smart Config
          </TabsTrigger>
          <TabsTrigger value="powermta-monitor" className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            PowerMTA Monitor
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Account Selection - Integrated into Compose Page */}
            <CompactAccountSelector
              selectedAccounts={selectedAccounts}
              onAccountsChange={handleAccountsChange}
              onSelectAll={handleSelectAllAccounts}
              onDeselectAll={handleDeselectAllAccounts}
            />
            
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

                {sendMethod === 'powermta' && (
                  <div>
                    <Label htmlFor="powerMTAServer">PowerMTA Server</Label>
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
                )}
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

                {/* Rate Limiting */}
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

        {/* Smart Configuration Tab */}
        <TabsContent value="smart-config" className="space-y-6">
          <SmartConfigurationPanel
            smartConfigEnabled={smartConfigEnabled}
            onSmartConfigChange={setSmartConfigEnabled}
            useManualOverride={useManualOverride}
            onManualOverrideChange={setUseManualOverride}
            functionsToUse={functionsToUse}
            onFunctionsToUseChange={setFunctionsToUse}
            accountsToUse={accountsToUse}
            onAccountsToUseChange={setAccountsToUse}
            smartOptimization={smartOptimization}
            onSmartOptimizationChange={setSmartOptimization}
          />
        </TabsContent>

        {/* PowerMTA Monitoring Tab */}
        <TabsContent value="powermta-monitor" className="space-y-6">
          <PowerMTAMonitoringPanel
            monitoringEnabled={monitoringEnabled}
            onMonitoringEnabledChange={setMonitoringEnabled}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Campaign analytics and performance metrics will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CampaignComposer;
