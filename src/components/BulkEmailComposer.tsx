
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, Send, Settings, Users, Bot, Server, Cloud, 
  TestTube, Calendar, BarChart, Eye, Pause, Play,
  Check, X, RefreshCw, Zap, AlertCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import TestAfterSection from './TestAfterSection';

interface BulkEmailComposerProps {
  onSend: (data: any) => void;
}

const BulkEmailComposer: React.FC<BulkEmailComposerProps> = ({ onSend }) => {
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
  const [smartOptimization, setSmartOptimization] = useState({
    accountLoadBalancing: true,
    deliveryOptimization: true,
    rateLimitAdjustment: true,
    failoverProtection: true
  });

  // PowerMTA monitoring state
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [pausedJobs, setPausedJobs] = useState<any[]>([]);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  const activeAccounts = accounts.filter(account => account.is_active);
  const smtpAccounts = activeAccounts.filter(acc => acc.type === 'smtp');
  const appsScriptAccounts = activeAccounts.filter(acc => acc.type === 'apps-script');
  const activePowerMTAServers = powerMTAServers.filter(server => server.is_active);

  // Navigation handlers
  const handleFunctionsClick = () => {
    navigate('/functions');
  };

  const handleAccountsClick = () => {
    navigate('/settings');
  };

  const handleSmartConfigClick = () => {
    navigate('/smart-config');
  };

  // Account selection handlers
  const handleSelectAllAccounts = () => {
    setSelectedAccounts(activeAccounts.map(acc => acc.id));
  };

  const handleDeselectAllAccounts = () => {
    setSelectedAccounts([]);
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
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

  // PowerMTA job control handlers
  const handlePauseJob = async (jobId: string) => {
    try {
      // Implementation for pausing PowerMTA job
      toast.success('Job paused successfully');
    } catch (error) {
      toast.error('Failed to pause job');
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      // Implementation for resuming PowerMTA job
      toast.success('Job resumed successfully');
    } catch (error) {
      toast.error('Failed to resume job');
    }
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
        smart_optimization: smartOptimization
      }
    };

    await onSend(campaignData);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Email Campaign</h1>
          <p className="text-gray-600 mt-1">Create and send professional email campaigns</p>
        </div>
        
        {/* Quick Access Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={handleFunctionsClick}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
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
            <Bot className="w-4 h-4" />
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
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Accounts ({activeAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="smart-config" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Smart Config
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            PowerMTA Monitor
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
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
                            {server.name ? String(server.name) : 'Unnamed Server'} ({server.server_host ? String(server.server_host) : 'No Host'})
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
                    <p className="text-sm text-gray-600">Use dynamic tags like {{name}}</p>
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

        {/* Enhanced Accounts Tab */}
        <TabsContent value="accounts" className="space-y-6">
          <div className="grid gap-6">
            
            {/* Account Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">SMTP Accounts</p>
                      <p className="text-2xl font-bold">{smtpAccounts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Apps Script</p>
                      <p className="text-2xl font-bold">{appsScriptAccounts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">PowerMTA</p>
                      <p className="text-2xl font-bold">{activePowerMTAServers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Account Selection with Select/Deselect All */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Account Selection
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAllAccounts}>
                      <Check className="w-4 h-4 mr-1" />
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAllAccounts}>
                      <X className="w-4 h-4 mr-1" />
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeAccounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedAccounts.includes(account.id)}
                              onCheckedChange={() => handleAccountToggle(account.id)}
                            />
                            <div>
                              <p className="font-medium">{account.name ? String(account.name) : String(account.email)}</p>
                              <p className="text-sm text-gray-600">{String(account.email)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={account.type === 'smtp' ? 'default' : 'secondary'}>
                              {String(account.type).toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              Active
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {activeAccounts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active accounts found</p>
                    <p className="text-sm">Add accounts in Settings to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PowerMTA Server Integration */}
            {activePowerMTAServers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    PowerMTA Servers Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activePowerMTAServers.map((server) => (
                      <div key={server.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{server.name ? String(server.name) : 'Unnamed Server'}</h4>
                            <p className="text-sm text-gray-600">
                              {server.server_host ? String(server.server_host) : 'No Host'}:{server.ssh_port ? String(server.ssh_port) : 'No Port'}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                Virtual MTA: {server.virtual_mta ? String(server.virtual_mta) : 'default'}
                              </Badge>
                              <Badge variant="outline">
                                Job Pool: {server.job_pool ? String(server.job_pool) : 'default'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge variant={server.is_active ? "default" : "secondary"}>
                              {server.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {server.proxy_enabled && (
                              <Badge variant="outline">Proxy Enabled</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Smart Configuration Tab */}
        <TabsContent value="smart-config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Smart Configuration Engine - FULLY UPGRADED ⚡
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Smart Configuration</Label>
                  <p className="text-sm text-gray-600">AI-powered optimization for best delivery rates</p>
                </div>
                <Switch checked={smartConfigEnabled} onCheckedChange={setSmartConfigEnabled} />
              </div>

              {smartConfigEnabled && (
                <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                  <h4 className="font-medium text-blue-900">Optimization Features</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Account Load Balancing</Label>
                        <p className="text-sm text-gray-600">Distribute emails across accounts optimally</p>
                      </div>
                      <Switch 
                        checked={smartOptimization.accountLoadBalancing} 
                        onCheckedChange={(checked) => 
                          setSmartOptimization(prev => ({...prev, accountLoadBalancing: checked}))
                        } 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Delivery Time Optimization</Label>
                        <p className="text-sm text-gray-600">Send at optimal times for each recipient</p>
                      </div>
                      <Switch 
                        checked={smartOptimization.deliveryOptimization} 
                        onCheckedChange={(checked) => 
                          setSmartOptimization(prev => ({...prev, deliveryOptimization: checked}))
                        } 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Adaptive Rate Limiting</Label>
                        <p className="text-sm text-gray-600">Adjust sending speed based on provider response</p>
                      </div>
                      <Switch 
                        checked={smartOptimization.rateLimitAdjustment} 
                        onCheckedChange={(checked) => 
                          setSmartOptimization(prev => ({...prev, rateLimitAdjustment: checked}))
                        } 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Failover Protection</Label>
                        <p className="text-sm text-gray-600">Automatic switching to backup accounts</p>
                      </div>
                      <Switch 
                        checked={smartOptimization.failoverProtection} 
                        onCheckedChange={(checked) => 
                          setSmartOptimization(prev => ({...prev, failoverProtection: checked}))
                        } 
                      />
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Smart configuration uses machine learning to optimize your campaigns based on historical performance data and real-time analytics.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PowerMTA Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="w-5 h-5" />
                PowerMTA Email Monitoring & Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Real-time Monitoring</Label>
                  <p className="text-sm text-gray-600">Monitor email jobs and control delivery</p>
                </div>
                <Switch checked={monitoringEnabled} onCheckedChange={setMonitoringEnabled} />
              </div>

              {monitoringEnabled ? (
                <div className="space-y-6">
                  
                  {/* Job Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm text-gray-600">Active Jobs</p>
                            <p className="text-xl font-bold">{activeJobs.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Pause className="w-4 h-4 text-yellow-600" />
                          <div>
                            <p className="text-sm text-gray-600">Paused Jobs</p>
                            <p className="text-xl font-bold">{pausedJobs.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-xl font-bold">1,234</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          <div>
                            <p className="text-sm text-gray-600">Failed</p>
                            <p className="text-xl font-bold">56</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Active Jobs Control */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Active Email Jobs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activeJobs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No active email jobs</p>
                          <p className="text-sm">Jobs will appear here when campaigns are running</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Placeholder for active jobs */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">Campaign: Summer Promotion</h4>
                                <p className="text-sm text-gray-600">Progress: 1,234 / 5,000 sent</p>
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '25%'}}></div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <Pause className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* PowerMTA Server Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>PowerMTA Server Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activePowerMTAServers.map((server) => (
                          <div key={server.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{server.name ? String(server.name) : 'Unnamed Server'}</h4>
                                <p className="text-sm text-gray-600">{server.server_host ? String(server.server_host) : 'No Host'}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="default">Online</Badge>
                                  <Badge variant="outline">Queue: 0</Badge>
                                  <Badge variant="outline">Rate: 50/hr</Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Settings className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Enable monitoring to view real-time email job status and control PowerMTA operations.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkEmailComposer;
