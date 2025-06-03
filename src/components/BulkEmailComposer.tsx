import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Mail, Upload, Play, Pause, Square, Users, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import CSVDataImporter from './CSVDataImporter';
import TagPreviewTool from './TagPreviewTool';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useEmailQueue } from '@/hooks/useEmailQueue';
import { toast } from '@/hooks/use-toast';

interface BulkEmailComposerProps {
  organizationId?: string;
}

interface RecipientData {
  email: string;
  [key: string]: any;
}

const BulkEmailComposer = ({ organizationId }: BulkEmailComposerProps) => {
  const { accounts } = useEmailAccounts(organizationId);
  const { createCampaign } = useCampaigns(organizationId);
  const { queues, createQueue, addJobsToQueue, updateQueueStatus } = useEmailQueue(organizationId);
  
  const [activeTab, setActiveTab] = useState('recipients');
  const [recipients, setRecipients] = useState<RecipientData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');

  const [bulkData, setBulkData] = useState({
    fromNames: [''],
    subjects: [''],
    htmlContent: '',
    textContent: '',
    sendMethod: 'smtp',
    maxConcurrent: 5,
    rateLimitDelay: 2,
    testEmail: '',
    testFrequency: 100,
    customHeaders: '{}'
  });

  const activeAccounts = accounts.filter(account => 
    account.is_active && account.type === bulkData.sendMethod
  );

  const handleImportData = (data: Array<{ [key: string]: any }>) => {
    // Ensure each item has an email field
    const validData: RecipientData[] = data
      .filter(item => item.email || item.Email || item.EMAIL)
      .map(item => ({
        email: item.email || item.Email || item.EMAIL,
        ...item
      }));

    setRecipients(validData);
    toast({
      title: "Data Imported",
      description: `Successfully imported ${validData.length} recipients`,
    });
  };

  const handleAddToQueue = async () => {
    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please import recipients before adding to queue",
        variant: "destructive"
      });
      return;
    }

    if (!bulkData.subjects[0] || !bulkData.htmlContent) {
      toast({
        title: "Missing Content",
        description: "Please add subject and email content",
        variant: "destructive"
      });
      return;
    }

    if (activeAccounts.length === 0) {
      toast({
        title: "No Active Accounts",
        description: `Please add and activate at least one ${bulkData.sendMethod.toUpperCase()} account`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create a new queue
      const queueName = `Bulk Campaign - ${new Date().toLocaleString()}`;
      const queue = await createQueue({
        name: queueName,
        total_jobs: recipients.length,
        completed_jobs: 0,
        failed_jobs: 0,
        status: 'pending',
        max_concurrent_sends: bulkData.maxConcurrent
      });

      if (queue) {
        // Create jobs for each recipient
        const jobs = recipients.map((recipient, index) => {
          const fromName = bulkData.fromNames[index % bulkData.fromNames.length];
          const subject = bulkData.subjects[index % bulkData.subjects.length];
          
          // Process placeholders
          const processedSubject = processPlaceholders(subject, recipient, fromName);
          const processedContent = processPlaceholders(bulkData.htmlContent, recipient, fromName);
          
          return {
            recipient_email: recipient.email,
            recipient_data: recipient,
            from_name: fromName,
            subject: processedSubject,
            html_content: processedContent,
            text_content: bulkData.textContent,
            custom_headers: JSON.parse(bulkData.customHeaders || '{}'),
            status: 'pending' as const,
            priority: 1,
            scheduled_at: new Date().toISOString(),
            retry_count: 0
          };
        });

        await addJobsToQueue(queue.id, jobs);
        
        toast({
          title: "Queue Created",
          description: `Added ${recipients.length} emails to the sending queue`,
        });
        
        setActiveTab('queue');
      }
    } catch (error) {
      console.error('Error creating bulk queue:', error);
      toast({
        title: "Error",
        description: "Failed to create bulk email queue",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPlaceholders = (content: string, recipient: RecipientData, fromName: string) => {
    return content
      .replace(/\{\{fromname\}\}/g, fromName)
      .replace(/\{\{to\}\}/g, recipient.email)
      .replace(/\{\{firstname\}\}/g, recipient.firstname || recipient.first_name || '')
      .replace(/\{\{lastname\}\}/g, recipient.lastname || recipient.last_name || '')
      .replace(/\{\{company\}\}/g, recipient.company || '')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{rndn_(\d+)\}\}/g, (match, length) => {
        return Math.random().toString(36).substring(2, 2 + parseInt(length));
      });
  };

  const handleStartQueue = (queueId: string) => {
    updateQueueStatus(queueId, 'running');
    setQueueStatus('running');
    // Simulate queue processing
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        setQueueStatus('completed');
        updateQueueStatus(queueId, 'completed');
        clearInterval(interval);
      }
      setQueueProgress(progress);
    }, 1000);
  };

  const insertTag = (tag: string) => {
    setBulkData(prev => ({
      ...prev,
      htmlContent: prev.htmlContent + tag
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Bulk Email Campaign</h2>
          <p className="text-slate-600">Professional bulk email sending with queue management</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{recipients.length} Recipients</Badge>
          <Badge variant="outline">{activeAccounts.length} Active Accounts</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recipients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Recipients
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipients">
          <Card>
            <CardHeader>
              <CardTitle>Import Recipients</CardTitle>
              <CardDescription>
                Import your recipient list from CSV data or other sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CSVDataImporter onImport={handleImportData} />
              
              {recipients.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Recipients Preview</h3>
                    <Badge variant="secondary">{recipients.length} contacts</Badge>
                  </div>
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 border-b">Email</th>
                          <th className="text-left p-2 border-b">First Name</th>
                          <th className="text-left p-2 border-b">Last Name</th>
                          <th className="text-left p-2 border-b">Company</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.slice(0, 10).map((recipient, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{recipient.email}</td>
                            <td className="p-2">{recipient.firstname || recipient.first_name || '-'}</td>
                            <td className="p-2">{recipient.lastname || recipient.last_name || '-'}</td>
                            <td className="p-2">{recipient.company || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recipients.length > 10 && (
                      <div className="p-2 text-center text-slate-500 bg-slate-50">
                        And {recipients.length - 10} more recipients...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>
                  Configure your email content and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Names (one per line)</Label>
                    <Textarea
                      placeholder="Company Name&#10;Sales Team&#10;Marketing Department"
                      value={bulkData.fromNames.join('\n')}
                      onChange={(e) => setBulkData(prev => ({
                        ...prev,
                        fromNames: e.target.value.split('\n').filter(name => name.trim())
                      }))}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Send Method</Label>
                    <Select 
                      value={bulkData.sendMethod} 
                      onValueChange={(value) => setBulkData(prev => ({ ...prev, sendMethod: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP Server</SelectItem>
                        <SelectItem value="apps-script">Google Apps Script</SelectItem>
                        <SelectItem value="powermta">PowerMTA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject Lines (one per line)</Label>
                  <Textarea
                    placeholder="Special Offer Just for You!&#10;Don't Miss Out - Limited Time&#10;Exclusive Deal Inside"
                    value={bulkData.subjects.join('\n')}
                    onChange={(e) => setBulkData(prev => ({
                      ...prev,
                      subjects: e.target.value.split('\n').filter(subject => subject.trim())
                    }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>HTML Content</Label>
                    <TagPreviewTool onTagInsert={insertTag} />
                  </div>
                  <Textarea
                    placeholder="Enter your HTML email content. Use placeholders like {{firstname}}, {{company}}, {{fromname}}"
                    value={bulkData.htmlContent}
                    onChange={(e) => setBulkData(prev => ({ ...prev, htmlContent: e.target.value }))}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                      Available: {"{{firstname}}, {{lastname}}, {{company}}, {{fromname}}, {{to}}, {{date}}, {{rndn_10}}"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Sending Settings</CardTitle>
              <CardDescription>
                Configure rate limiting and advanced sending options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Concurrent Sends</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={bulkData.maxConcurrent}
                    onChange={(e) => setBulkData(prev => ({ ...prev, maxConcurrent: parseInt(e.target.value) || 5 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit Delay (seconds)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bulkData.rateLimitDelay}
                    onChange={(e) => setBulkData(prev => ({ ...prev, rateLimitDelay: parseInt(e.target.value) || 2 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Test Email Frequency</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Send test every X emails"
                    value={bulkData.testFrequency}
                    onChange={(e) => setBulkData(prev => ({ ...prev, testFrequency: parseInt(e.target.value) || 100 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Test Email Address</Label>
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={bulkData.testEmail}
                  onChange={(e) => setBulkData(prev => ({ ...prev, testEmail: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Custom Headers (JSON)</Label>
                <Textarea
                  placeholder='{"Reply-To": "noreply@example.com", "X-Campaign": "bulk-2024"}'
                  value={bulkData.customHeaders}
                  onChange={(e) => setBulkData(prev => ({ ...prev, customHeaders: e.target.value }))}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              {activeAccounts.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Active Sending Accounts:</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeAccounts.map(account => (
                      <Badge key={account.id} variant="secondary" className="bg-green-100 text-green-800">
                        {account.name} ({account.email})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Queue Management</CardTitle>
                <CardDescription>
                  Monitor and control your bulk email sending queue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium">Queue Status: {queueStatus}</h3>
                    <p className="text-sm text-slate-600">
                      {recipients.length} emails ready to send
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={handleAddToQueue}
                      disabled={isProcessing || recipients.length === 0}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Add to Queue
                        </>
                      )}
                    </Button>
                    {queueStatus === 'idle' && queues.length > 0 && (
                      <Button onClick={() => handleStartQueue(queues[0].id)}>
                        <Play className="w-4 h-4 mr-2" />
                        Start Queue
                      </Button>
                    )}
                    {queueStatus === 'running' && (
                      <Button variant="outline" onClick={() => setQueueStatus('paused')}>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    {queueStatus === 'paused' && (
                      <Button onClick={() => setQueueStatus('running')}>
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    <Button variant="destructive" onClick={() => {
                      setQueueStatus('idle');
                      setQueueProgress(0);
                    }}>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>

                {queueStatus !== 'idle' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(queueProgress)}%</span>
                    </div>
                    <Progress value={queueProgress} className="w-full" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-600">Pending</p>
                        <p className="text-xl font-bold text-blue-800">{recipients.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Sent</p>
                        <p className="text-xl font-bold text-green-800">0</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm text-red-600">Failed</p>
                        <p className="text-xl font-bold text-red-800">0</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="text-sm text-yellow-600">Processing</p>
                        <p className="text-xl font-bold text-yellow-800">0</p>
                      </div>
                    </div>
                  </div>
                </div>

                {queues.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-medium mb-4">Recent Queues</h4>
                    <div className="space-y-2">
                      {queues.slice(0, 5).map((queue) => (
                        <div key={queue.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{queue.name}</p>
                            <p className="text-sm text-slate-600">
                              {queue.completed_jobs}/{queue.total_jobs} completed
                            </p>
                          </div>
                          <Badge variant={queue.status === 'completed' ? 'default' : 'secondary'}>
                            {queue.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkEmailComposer;
