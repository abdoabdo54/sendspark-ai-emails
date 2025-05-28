
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Upload, FileSpreadsheet, Loader2, Send, Pause, Play, Trash2 } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useEmailQueue, BulkEmailData } from '@/hooks/useEmailQueue';
import { toast } from '@/hooks/use-toast';
import CSVDataImporter from './CSVDataImporter';
import GoogleSheetsImport from './GoogleSheetsImport';

interface BulkEmailComposerProps {
  organizationId?: string;
}

const BulkEmailComposer = ({ organizationId }: BulkEmailComposerProps) => {
  const { accounts } = useEmailAccounts(organizationId);
  const { 
    queues, 
    createBulkQueue, 
    startQueue, 
    pauseQueue, 
    deleteQueue, 
    processing 
  } = useEmailQueue(organizationId);

  const [activeTab, setActiveTab] = useState('compose');
  const [recipients, setRecipients] = useState<Array<{ email: string; [key: string]: any }>>([]);
  const [fromNames, setFromNames] = useState<string[]>(['']);
  const [subjects, setSubjects] = useState<string[]>(['']);
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [customHeaders, setCustomHeaders] = useState<{ [key: string]: string }>({});
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [maxConcurrentSends, setMaxConcurrentSends] = useState(5);
  const [rateLimitPerHour, setRateLimitPerHour] = useState(100);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailFrequency, setTestEmailFrequency] = useState(100);
  const [enableTestEmails, setEnableTestEmails] = useState(false);

  const activeAccounts = accounts.filter(account => account.is_active);

  const addFromName = () => {
    setFromNames([...fromNames, '']);
  };

  const updateFromName = (index: number, value: string) => {
    const updated = [...fromNames];
    updated[index] = value;
    setFromNames(updated);
  };

  const removeFromName = (index: number) => {
    if (fromNames.length > 1) {
      setFromNames(fromNames.filter((_, i) => i !== index));
    }
  };

  const addSubject = () => {
    setSubjects([...subjects, '']);
  };

  const updateSubject = (index: number, value: string) => {
    const updated = [...subjects];
    updated[index] = value;
    setSubjects(updated);
  };

  const removeSubject = (index: number) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const addCustomHeader = () => {
    const key = `Header-${Object.keys(customHeaders).length + 1}`;
    setCustomHeaders({ ...customHeaders, [key]: '' });
  };

  const updateCustomHeader = (oldKey: string, newKey: string, value: string) => {
    const updated = { ...customHeaders };
    delete updated[oldKey];
    updated[newKey] = value;
    setCustomHeaders(updated);
  };

  const removeCustomHeader = (key: string) => {
    const updated = { ...customHeaders };
    delete updated[key];
    setCustomHeaders(updated);
  };

  const handleManualRecipients = (emails: string) => {
    const emailList = emails.split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0)
      .map(email => ({ email }));
    setRecipients(emailList);
  };

  const handleCSVImport = (data: Array<{ [key: string]: any }>) => {
    if (data.length > 0 && data[0].email) {
      setRecipients(data);
      toast({
        title: "CSV Imported",
        description: `Imported ${data.length} recipients from CSV`,
      });
    } else {
      toast({
        title: "Import Error",
        description: "CSV must contain an 'email' column",
        variant: "destructive"
      });
    }
  };

  const handleGoogleSheetsImport = (emails: string[]) => {
    const emailList = emails.map(email => ({ email }));
    setRecipients(emailList);
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleCreateQueue = async () => {
    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add recipients before creating a queue",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "No Accounts Selected",
        description: "Please select at least one sending account",
        variant: "destructive"
      });
      return;
    }

    if (fromNames.filter(name => name.trim()).length === 0) {
      toast({
        title: "No From Names",
        description: "Please add at least one from name",
        variant: "destructive"
      });
      return;
    }

    if (subjects.filter(subject => subject.trim()).length === 0) {
      toast({
        title: "No Subjects",
        description: "Please add at least one subject line",
        variant: "destructive"
      });
      return;
    }

    if (!htmlContent.trim()) {
      toast({
        title: "No Content",
        description: "Please add email content",
        variant: "destructive"
      });
      return;
    }

    const bulkData: BulkEmailData = {
      recipients,
      fromNames: fromNames.filter(name => name.trim()),
      subjects: subjects.filter(subject => subject.trim()),
      htmlContent,
      textContent,
      customHeaders,
      sendingAccounts: selectedAccounts,
      maxConcurrentSends,
      rateLimitPerHour,
      testEmailAddress: enableTestEmails ? testEmailAddress : undefined,
      testEmailFrequency: enableTestEmails ? testEmailFrequency : undefined
    };

    await createBulkQueue(bulkData);
    setActiveTab('queues');
  };

  const getAvailablePlaceholders = () => {
    const standardPlaceholders = [
      '{{fromname}}', '{{subject}}', '{{to}}', '{{name}}', '{{date}}', '{{ide}}',
      '{{rndn_10}}', '{{rnda_5}}', '{{tag}}'
    ];

    const dataPlaceholders = recipients.length > 0 
      ? Object.keys(recipients[0]).map(key => `{{${key}}}`)
      : [];

    return [...standardPlaceholders, ...dataPlaceholders];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Bulk Email Campaign</h2>
          <p className="text-slate-600">Professional bulk email sending with advanced features</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">
            {recipients.length} recipients
          </Badge>
          <Badge variant="outline">
            {selectedAccounts.length} accounts
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compose">Compose Campaign</TabsTrigger>
          <TabsTrigger value="queues">Queue Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          {/* Recipients Section */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients ({recipients.length})</CardTitle>
              <CardDescription>
                Add recipients manually, import from CSV, or connect Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="manual">
                <TabsList>
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                  <TabsTrigger value="csv">CSV Import</TabsTrigger>
                  <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <Label>Email Addresses (comma-separated)</Label>
                  <Textarea
                    placeholder="user1@example.com, user2@example.com, user3@example.com"
                    rows={4}
                    onChange={(e) => handleManualRecipients(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="csv">
                  <CSVDataImporter onImport={handleCSVImport} />
                </TabsContent>

                <TabsContent value="sheets">
                  <GoogleSheetsImport onImport={handleGoogleSheetsImport} />
                </TabsContent>
              </Tabs>

              {recipients.length > 0 && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✓ {recipients.length} recipients loaded
                  </p>
                  {recipients.length > 0 && Object.keys(recipients[0]).length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs text-green-700">Available data fields:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(recipients[0]).map(key => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sending Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Sending Accounts</CardTitle>
              <CardDescription>
                Select accounts to rotate through for sending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAccounts.map(account => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAccounts.includes(account.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => toggleAccountSelection(account.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-slate-600">{account.email}</p>
                        <Badge variant="outline" className="mt-1">
                          {account.type.toUpperCase()}
                        </Badge>
                      </div>
                      {selectedAccounts.includes(account.id) && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* From Names */}
          <Card>
            <CardHeader>
              <CardTitle>From Names (Rotation)</CardTitle>
              <CardDescription>
                Multiple from names will be rotated for each email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fromNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`From Name ${index + 1}`}
                    value={name}
                    onChange={(e) => updateFromName(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFromName(index)}
                    disabled={fromNames.length === 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addFromName} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add From Name
              </Button>
            </CardContent>
          </Card>

          {/* Subject Lines */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Lines (Rotation)</CardTitle>
              <CardDescription>
                Multiple subjects will be rotated for each email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {subjects.map((subject, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Subject Line ${index + 1}`}
                    value={subject}
                    onChange={(e) => updateSubject(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeSubject(index)}
                    disabled={subjects.length === 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addSubject} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Subject Line
              </Button>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>
                HTML and text content with placeholder support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Available Placeholders</Label>
                <div className="flex flex-wrap gap-1">
                  {getAvailablePlaceholders().map(placeholder => (
                    <Badge 
                      key={placeholder} 
                      variant="secondary" 
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setHtmlContent(prev => prev + placeholder);
                      }}
                    >
                      {placeholder}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  placeholder="Enter your HTML email content with placeholders like {{fromname}}, {{email}}, etc."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Plain Text Content (Optional)</Label>
                <Textarea
                  placeholder="Plain text version of your email"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={8}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure sending behavior and rate limiting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Concurrent Sends</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={maxConcurrentSends}
                    onChange={(e) => setMaxConcurrentSends(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit (emails/hour)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={rateLimitPerHour}
                    onChange={(e) => setRateLimitPerHour(parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Enable Test Emails</Label>
                    <p className="text-sm text-slate-500">
                      Send test emails periodically during the campaign
                    </p>
                  </div>
                  <Switch
                    checked={enableTestEmails}
                    onCheckedChange={setEnableTestEmails}
                  />
                </div>

                {enableTestEmails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label>Test Email Address</Label>
                      <Input
                        type="email"
                        placeholder="test@example.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Send test every X emails</Label>
                      <Input
                        type="number"
                        min="1"
                        value={testEmailFrequency}
                        onChange={(e) => setTestEmailFrequency(parseInt(e.target.value) || 100)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Custom Email Headers</Label>
                {Object.entries(customHeaders).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={key}
                      onChange={(e) => updateCustomHeader(key, e.target.value, value)}
                      className="w-1/3"
                    />
                    <Input
                      placeholder="Header value"
                      value={value}
                      onChange={(e) => updateCustomHeader(key, key, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomHeader(key)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addCustomHeader} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Header
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Create Queue Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleCreateQueue}
                disabled={processing || recipients.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Queue...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Create Bulk Email Queue
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Queues</CardTitle>
              <CardDescription>
                Manage and monitor your email sending queues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {queues.map(queue => (
                  <div key={queue.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">{queue.name}</h3>
                        <p className="text-sm text-slate-600">
                          Created {new Date(queue.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {queue.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => startQueue(queue.id)}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {queue.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pauseQueue(queue.id)}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {queue.status === 'paused' && (
                          <Button
                            size="sm"
                            onClick={() => startQueue(queue.id)}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteQueue(queue.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Status</p>
                        <Badge variant={
                          queue.status === 'completed' ? 'default' :
                          queue.status === 'running' ? 'secondary' :
                          queue.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {queue.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-slate-600">Progress</p>
                        <p className="font-medium">
                          {queue.completed_jobs} / {queue.total_jobs}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Failed</p>
                        <p className="font-medium text-red-600">{queue.failed_jobs}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Concurrent</p>
                        <p className="font-medium">{queue.max_concurrent_sends}</p>
                      </div>
                    </div>

                    {queue.total_jobs > 0 && (
                      <div className="mt-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(queue.completed_jobs / queue.total_jobs) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {Math.round((queue.completed_jobs / queue.total_jobs) * 100)}% complete
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {queues.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No email queues yet</p>
                    <p className="text-sm">Create your first bulk campaign to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
              <CardDescription>
                Real-time analytics and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                <p>Analytics dashboard coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkEmailComposer;
