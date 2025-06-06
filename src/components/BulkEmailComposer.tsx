
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Eye } from 'lucide-react';

const BulkEmailComposer = () => {
  const { currentOrganization } = useOrganizations();
  const { createCampaign } = useCampaigns(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);

  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sendingMethod, setSendingMethod] = useState('sequential');
  
  // Rotation settings
  const [useRotation, setUseRotation] = useState(false);
  const [rotationFromNames, setRotationFromNames] = useState<string[]>(['']);
  const [rotationSubjects, setRotationSubjects] = useState<string[]>(['']);
  
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const activeAccounts = accounts.filter(account => account.is_active);

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const addRotationFromName = () => {
    setRotationFromNames(prev => [...prev, '']);
  };

  const updateRotationFromName = (index: number, value: string) => {
    setRotationFromNames(prev => prev.map((name, i) => i === index ? value : name));
  };

  const removeRotationFromName = (index: number) => {
    setRotationFromNames(prev => prev.filter((_, i) => i !== index));
  };

  const addRotationSubject = () => {
    setRotationSubjects(prev => [...prev, '']);
  };

  const updateRotationSubject = (index: number, value: string) => {
    setRotationSubjects(prev => prev.map((subject, i) => i === index ? value : subject));
  };

  const removeRotationSubject = (index: number) => {
    setRotationSubjects(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateCampaign = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive"
      });
      return;
    }

    if (!fromName || !subject || !recipients) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one email account",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const campaignConfig = {
        selectedAccounts,
        sendingMethod,
        rotation: {
          useRotation,
          fromNames: useRotation ? rotationFromNames.filter(name => name.trim()) : [],
          subjects: useRotation ? rotationSubjects.filter(subject => subject.trim()) : []
        }
      };

      const campaignData = {
        from_name: fromName,
        subject: subject,
        recipients: recipients,
        html_content: htmlContent,
        text_content: textContent,
        send_method: 'bulk',
        config: campaignConfig
      };

      console.log('Creating campaign with data:', campaignData);
      
      await createCampaign(campaignData);
      
      // Reset form
      setFromName('');
      setSubject('');
      setRecipients('');
      setHtmlContent('');
      setTextContent('');
      setSelectedAccounts([]);
      setUseRotation(false);
      setRotationFromNames(['']);
      setRotationSubjects(['']);
      
      toast({
        title: "Success",
        description: "Campaign created successfully!"
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to create campaign: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;
  const validFromNames = rotationFromNames.filter(name => name.trim());
  const validSubjects = rotationSubjects.filter(subject => subject.trim());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Email Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name *</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Recipients * (comma-separated emails)</Label>
            <Textarea
              id="recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email1@example.com, email2@example.com, ..."
              className="min-h-[100px]"
              required
            />
            {recipientCount > 0 && (
              <Badge variant="outline">{recipientCount} recipients</Badge>
            )}
          </div>

          <Tabs defaultValue="html" className="w-full">
            <TabsList>
              <TabsTrigger value="html">HTML Content</TabsTrigger>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            
            <TabsContent value="html" className="space-y-2">
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="Enter your HTML email content here..."
                className="min-h-[300px] font-mono"
              />
            </TabsContent>
            
            <TabsContent value="text" className="space-y-2">
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Enter your plain text email content here..."
                className="min-h-[300px]"
              />
            </TabsContent>

            <TabsContent value="preview" className="space-y-2">
              <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                <div className="border-b pb-2 mb-4">
                  <div className="text-sm text-gray-600">
                    <strong>From:</strong> {fromName || 'Your Name'}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Subject:</strong> {subject || 'Email subject'}
                  </div>
                </div>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: htmlContent || '<p>Your HTML content will appear here...</p>' 
                  }} 
                />
              </div>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {activeAccounts.length === 0 ? (
                <p className="text-gray-500">No active email accounts found. Please add and configure email accounts first.</p>
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
                      </div>
                    </div>
                  ))}
                  
                  {selectedAccounts.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label>Sending Method</Label>
                        <Select value={sendingMethod} onValueChange={setSendingMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sequential">Sequential (use first account)</SelectItem>
                            <SelectItem value="round-robin">Round Robin (rotate accounts)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>Content Rotation</span>
                <Switch
                  checked={useRotation}
                  onCheckedChange={setUseRotation}
                />
              </CardTitle>
            </CardHeader>
            {useRotation && (
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>From Names</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRotationFromName}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {rotationFromNames.map((name, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={name}
                        onChange={(e) => updateRotationFromName(index, e.target.value)}
                        placeholder={`From name ${index + 1}`}
                      />
                      {rotationFromNames.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeRotationFromName(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {validFromNames.length > 1 && (
                    <Badge variant="outline">{validFromNames.length} from names will rotate</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Subject Lines</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRotationSubject}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {rotationSubjects.map((subjectLine, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={subjectLine}
                        onChange={(e) => updateRotationSubject(index, e.target.value)}
                        placeholder={`Subject line ${index + 1}`}
                      />
                      {rotationSubjects.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeRotationSubject(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {validSubjects.length > 1 && (
                    <Badge variant="outline">{validSubjects.length} subjects will rotate</Badge>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          <Button 
            onClick={handleCreateCampaign} 
            disabled={loading || !fromName || !subject || !recipients || selectedAccounts.length === 0}
            className="w-full"
          >
            {loading ? 'Creating Campaign...' : 'Create Campaign'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
