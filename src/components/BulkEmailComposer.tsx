import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Upload, Type, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import CSVDataImporter from './CSVDataImporter';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer: React.FC<BulkEmailComposerProps> = ({ onSend }) => {
  const { currentOrganization, loading: orgLoading } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [recipientsData, setRecipientsData] = useState<Array<{ [key: string]: any }>>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sendingMethod, setSendingMethod] = useState('round-robin');
  
  // Rotation settings
  const [useFromNameRotation, setUseFromNameRotation] = useState(false);
  const [fromNameRotations, setFromNameRotations] = useState<string[]>(['']);
  const [useSubjectRotation, setUseSubjectRotation] = useState(false);
  const [subjectRotations, setSubjectRotations] = useState<string[]>(['']);

  const activeAccounts = accounts.filter(account => account.is_active);

  // Refresh accounts when organization changes
  useEffect(() => {
    if (currentOrganization?.id) {
      refetch();
    }
  }, [currentOrganization?.id, refetch]);

  const handleCSVImport = (data: Array<{ [key: string]: any }>) => {
    setRecipientsData(data);
    toast({
      title: "Recipients Imported",
      description: `Successfully imported ${data.length} recipients from CSV`
    });
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const addFromNameRotation = () => {
    setFromNameRotations(prev => [...prev, '']);
  };

  const updateFromNameRotation = (index: number, value: string) => {
    setFromNameRotations(prev => prev.map((name, i) => i === index ? value : name));
  };

  const removeFromNameRotation = (index: number) => {
    setFromNameRotations(prev => prev.filter((_, i) => i !== index));
  };

  const addSubjectRotation = () => {
    setSubjectRotations(prev => [...prev, '']);
  };

  const updateSubjectRotation = (index: number, value: string) => {
    setSubjectRotations(prev => prev.map((subject, i) => i === index ? value : subject));
  };

  const removeSubjectRotation = (index: number) => {
    setSubjectRotations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Organization Required",
        description: "Please set up your organization first",
        variant: "destructive"
      });
      return;
    }

    let finalRecipients = '';
    
    if (recipientsData.length > 0) {
      const emails = recipientsData.map(row => {
        const emailField = Object.keys(row).find(key => 
          key.toLowerCase().includes('email')
        );
        return emailField ? row[emailField] : '';
      }).filter(email => email);
      
      finalRecipients = emails.join(',');
    } else if (manualRecipients.trim()) {
      finalRecipients = manualRecipients;
    }

    if (!finalRecipients) {
      toast({
        title: "No Recipients",
        description: "Please add recipients either by importing CSV or manual input",
        variant: "destructive"
      });
      return;
    }

    if (!fromName.trim() || !subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in From Name and Subject",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "No Accounts Selected",
        description: "Please select at least one email account",
        variant: "destructive"
      });
      return;
    }

    const campaignData = {
      from_name: fromName,
      subject,
      recipients: finalRecipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'bulk',
      config: {
        selectedAccounts,
        sendingMethod,
        rotation: {
          useFromNameRotation,
          fromNames: useFromNameRotation ? fromNameRotations.filter(name => name.trim()) : [],
          useSubjectRotation,
          subjects: useSubjectRotation ? subjectRotations.filter(subject => subject.trim()) : []
        }
      },
      recipientData: recipientsData
    };

    onSend(campaignData);
  };

  const validFromNames = fromNameRotations.filter(name => name.trim());
  const validSubjects = subjectRotations.filter(subject => subject.trim());

  if (orgLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading organization...</p>
      </div>
    );
  }

  if (!currentOrganization?.id) {
    return (
      <div className="text-center py-8 text-slate-500">
        Please set up your organization first to create campaigns.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Email Campaign
          </CardTitle>
          <CardDescription>
            Create and send personalized emails to multiple recipients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name or Company"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
          </div>

          {/* FROM Name Rotation */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label>FROM Name Rotation</Label>
              <Switch
                checked={useFromNameRotation}
                onCheckedChange={setUseFromNameRotation}
              />
            </div>
            
            {useFromNameRotation && (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label>FROM Names (will rotate instead of main FROM name)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFromNameRotation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {fromNameRotations.map((name, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={name}
                      onChange={(e) => updateFromNameRotation(index, e.target.value)}
                      placeholder={`FROM name ${index + 1}`}
                    />
                    {fromNameRotations.length > 1 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => removeFromNameRotation(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {validFromNames.length > 1 && (
                  <Badge variant="outline">{validFromNames.length} FROM names will rotate</Badge>
                )}
              </div>
            )}
          </div>

          {/* Subject Rotation */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label>Subject Rotation</Label>
              <Switch
                checked={useSubjectRotation}
                onCheckedChange={setUseSubjectRotation}
              />
            </div>
            
            {useSubjectRotation && (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label>Subject Lines (will rotate instead of main subject)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSubjectRotation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {subjectRotations.map((subjectLine, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={subjectLine}
                      onChange={(e) => updateSubjectRotation(index, e.target.value)}
                      placeholder={`Subject line ${index + 1}`}
                    />
                    {subjectRotations.length > 1 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => removeSubjectRotation(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {validSubjects.length > 1 && (
                  <Badge variant="outline">{validSubjects.length} subjects will rotate</Badge>
                )}
              </div>
            )}
          </div>

          {/* Email Accounts Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Email Accounts *</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refetch}
                disabled={accountsLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${accountsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {accountsLoading ? (
              <div className="p-4 border rounded-lg text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Loading accounts...</p>
              </div>
            ) : activeAccounts.length === 0 ? (
              <div className="p-4 border rounded-lg text-center">
                <p className="text-gray-500 mb-2">No active email accounts found.</p>
                <p className="text-sm text-gray-400">
                  Please add email accounts in the Accounts section first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAccounts.map((account) => (
                  <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => handleAccountToggle(account.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{account.name}</span>
                        <Badge variant="outline">{account.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{account.email}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        Rate: {account.config?.emails_per_second || 1}/sec, {account.config?.emails_per_hour || 3600}/hour
                      </div>
                    </div>
                  </div>
                ))}
                
                {selectedAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Sending Method</Label>
                    <Select value={sendingMethod} onValueChange={setSendingMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round-robin">Round Robin (rotate accounts)</SelectItem>
                        <SelectItem value="sequential">Sequential (use first account)</SelectItem>
                        <SelectItem value="parallel">Parallel (all accounts simultaneously)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import Recipients
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Manual Input
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <CSVDataImporter onImport={handleCSVImport} />
              
              {recipientsData.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {recipientsData.length} Recipients Loaded
                    </Badge>
                  </div>
                  <p className="text-sm text-green-700">
                    Recipients imported successfully. You can use column names like {'{firstname}'}, {'{lastname}'}, {'{company}'} for personalization.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipients">Email Recipients</Label>
                <Textarea
                  id="recipients"
                  placeholder="Enter email addresses separated by commas or new lines&#10;john@example.com, jane@example.com&#10;or&#10;john@example.com&#10;jane@example.com"
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  rows={6}
                />
                <p className="text-sm text-slate-500">
                  Enter email addresses separated by commas or new lines
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="htmlContent">Email Content (HTML)</Label>
            <Textarea
              id="htmlContent"
              placeholder="<h1>Hello {firstname}!</h1><p>Your personalized email content here...</p>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={8}
            />
            <p className="text-sm text-slate-500">
              Use variables like {'{firstname}'}, {'{lastname}'}, {'{email}'} for personalization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textContent">Plain Text Version (Optional)</Label>
            <Textarea
              id="textContent"
              placeholder="Hello {firstname}! Your plain text email content here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleSend}
            className="w-full"
            size="lg"
            disabled={!fromName || !subject || selectedAccounts.length === 0 || !currentOrganization?.id}
          >
            <Send className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
