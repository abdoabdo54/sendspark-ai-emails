
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
import { Mail, Upload, Play, Pause, Square, Users, Clock, CheckCircle, AlertCircle, Loader2, Calendar } from 'lucide-react';
import CSVDataImporter from './CSVDataImporter';
import TagPreviewTool from './TagPreviewTool';
import CampaignScheduler from './CampaignScheduler';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { toast } from '@/hooks/use-toast';

interface BulkEmailComposerProps {
  organizationId?: string;
}

interface RecipientData {
  email: string;
  [key: string]: any;
}

interface ScheduleOptions {
  enabled: boolean;
  scheduleType: 'immediate' | 'scheduled' | 'recurring';
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  recurringPattern: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  endDate?: string;
}

const BulkEmailComposer = ({ organizationId }: BulkEmailComposerProps) => {
  const { accounts } = useEmailAccounts(organizationId);
  
  const [activeTab, setActiveTab] = useState('recipients');
  const [recipients, setRecipients] = useState<RecipientData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [schedule, setSchedule] = useState<ScheduleOptions>({
    enabled: false,
    scheduleType: 'immediate',
    scheduledDate: '',
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurringPattern: 'weekly',
    recurringInterval: 1
  });

  const [bulkData, setBulkData] = useState({
    fromNames: ['Demo Campaign'],
    subjects: ['Welcome to our newsletter!'],
    htmlContent: '<h1>Hello {{firstname}}!</h1><p>Welcome to our newsletter from {{fromname}}.</p><p>We hope you enjoy our content.</p>',
    textContent: 'Hello {{firstname}}! Welcome to our newsletter from {{fromname}}. We hope you enjoy our content.',
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

  const handleScheduleChange = (newSchedule: ScheduleOptions) => {
    setSchedule(newSchedule);
  };

  const handleSendCampaign = async () => {
    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please import recipients before sending",
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

    if (schedule.enabled && schedule.scheduleType !== 'immediate') {
      if (!schedule.scheduledDate || !schedule.scheduledTime) {
        toast({
          title: "Schedule Incomplete",
          description: "Please set both date and time for scheduled campaigns",
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);
    
    try {
      // Simulate campaign creation
      const campaignName = `Bulk Campaign - ${new Date().toLocaleString()}`;
      
      if (schedule.enabled && schedule.scheduleType !== 'immediate') {
        toast({
          title: "Campaign Scheduled",
          description: `Campaign "${campaignName}" has been scheduled successfully`,
        });
      } else {
        // Simulate sending progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 100) {
            progress = 100;
            setQueueStatus('completed');
            clearInterval(interval);
            toast({
              title: "Campaign Sent",
              description: `Successfully sent ${recipients.length} emails`,
            });
          }
          setQueueProgress(progress);
        }, 1000);
        
        setQueueStatus('running');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast({
        title: "Error",
        description: "Failed to send campaign",
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
          <h2 className="text-3xl font-bold text-slate-800">Bulk Email Campaign</h2>
          <p className="text-slate-600">Professional bulk email sending with advanced scheduling</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            {recipients.length} Recipients
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {activeAccounts.length} Active Accounts
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="recipients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Recipients
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Send
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
                  <div className="text-xs text-slate-500">
                    Available placeholders: firstname, lastname, company, fromname, to, date, rndn_10
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <CampaignScheduler 
            onScheduleChange={handleScheduleChange}
            initialSchedule={schedule}
          />
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

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Summary & Send</CardTitle>
              <CardDescription>
                Review your campaign details and send when ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Recipients</h4>
                    <p className="text-sm text-slate-600">{recipients.length} recipients imported</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Content</h4>
                    <p className="text-sm text-slate-600">
                      {bulkData.subjects.length} subject line(s), HTML content ready
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Sending Method</h4>
                    <p className="text-sm text-slate-600">
                      {bulkData.sendMethod.toUpperCase()} ({activeAccounts.length} active accounts)
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Schedule</h4>
                    <p className="text-sm text-slate-600">
                      {schedule.enabled 
                        ? schedule.scheduleType === 'immediate' 
                          ? 'Send immediately'
                          : `Scheduled for ${schedule.scheduledDate} at ${schedule.scheduledTime}`
                        : 'Send immediately'
                      }
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Rate Limiting</h4>
                    <p className="text-sm text-slate-600">
                      Max {bulkData.maxConcurrent} concurrent, {bulkData.rateLimitDelay}s delay
                    </p>
                  </div>
                </div>
              </div>

              {queueStatus === 'running' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sending Progress</span>
                    <span>{Math.round(queueProgress)}%</span>
                  </div>
                  <Progress value={queueProgress} className="w-full" />
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={handleSendCampaign}
                  disabled={isProcessing || recipients.length === 0 || !bulkData.htmlContent}
                  className="flex-1"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {schedule.enabled && schedule.scheduleType !== 'immediate' ? 'Scheduling...' : 'Sending...'}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {schedule.enabled && schedule.scheduleType !== 'immediate' ? 'Schedule Campaign' : 'Send Campaign'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkEmailComposer;
