import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit, Settings, Zap, Users, Hash } from 'lucide-react';
import { Campaign, useCampaigns } from '@/hooks/useCampaigns';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';

interface CampaignEditDialogProps {
  campaign: Campaign;
  trigger?: React.ReactNode;
}

// Helper function to parse rotation data from campaign config
const parseRotationFromConfig = (rotationData: any): string[] => {
  if (!rotationData) return [''];
  
  if (Array.isArray(rotationData)) {
    return rotationData.length > 0 ? rotationData : [''];
  }
  
  if (typeof rotationData === 'string') {
    const parsed = rotationData.trim().split('\n').map(item => item.trim()).filter(item => item.length > 0);
    return parsed.length > 0 ? parsed : [''];
  }
  
  return [''];
};

const CampaignEditDialog = ({ campaign, trigger }: CampaignEditDialogProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { updateCampaign } = useCampaigns(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  const { functions } = useGcfFunctions(currentOrganization?.id);

  const [open, setOpen] = useState(false);
  const [fromName, setFromName] = useState(campaign.from_name);
  const [subject, setSubject] = useState(campaign.subject);
  const [recipients, setRecipients] = useState(campaign.recipients);
  const [htmlContent, setHtmlContent] = useState(campaign.html_content || '');
  const [textContent, setTextContent] = useState(campaign.text_content || '');
  
  // FIXED: Initialize with existing config values
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    campaign.config?.selectedAccounts || []
  );
  const [sendingMode, setSendingMode] = useState(campaign.config?.sendingMode || 'controlled');
  const [dispatchMethod, setDispatchMethod] = useState(campaign.config?.dispatchMethod || 'parallel');
  const [useCustomConfig, setUseCustomConfig] = useState(campaign.config?.useCustomConfig || false);
  const [customFunctionCount, setCustomFunctionCount] = useState(campaign.config?.customFunctionCount || 1);
  const [customAccountCount, setCustomAccountCount] = useState(campaign.config?.customAccountCount || 1);
  
  // Rotation settings - FIXED: Properly parse rotation data
  const [useFromNameRotation, setUseFromNameRotation] = useState(campaign.config?.rotation?.useFromNameRotation || false);
  const [fromNameRotations, setFromNameRotations] = useState<string[]>(
    parseRotationFromConfig(campaign.config?.rotation?.fromNames)
  );
  const [useSubjectRotation, setUseSubjectRotation] = useState(campaign.config?.rotation?.useSubjectRotation || false);
  const [subjectRotations, setSubjectRotations] = useState<string[]>(
    parseRotationFromConfig(campaign.config?.rotation?.subjects)
  );
  
  // Test After settings
  const [testAfterEnabled, setTestAfterEnabled] = useState(campaign.config?.testAfter?.enabled || false);
  const [testAfterEmail, setTestAfterEmail] = useState(campaign.config?.testAfter?.email || '');
  const [testAfterCount, setTestAfterCount] = useState(campaign.config?.testAfter?.count || 10);
  
  const [loading, setLoading] = useState(false);

  // FIXED: Reset form when campaign changes
  useEffect(() => {
    if (campaign && open) {
      setFromName(campaign.from_name);
      setSubject(campaign.subject);
      setRecipients(campaign.recipients);
      setHtmlContent(campaign.html_content || '');
      setTextContent(campaign.text_content || '');
      setSelectedAccounts(campaign.config?.selectedAccounts || []);
      setSendingMode(campaign.config?.sendingMode || 'controlled');
      setDispatchMethod(campaign.config?.dispatchMethod || 'parallel');
      setUseCustomConfig(campaign.config?.useCustomConfig || false);
      setCustomFunctionCount(campaign.config?.customFunctionCount || 1);
      setCustomAccountCount(campaign.config?.customAccountCount || 1);
      
      console.log('🔧 Form reset with campaign config:', campaign.config);
    }
  }, [campaign, open]);

  const activeAccounts = accounts.filter(account => account.is_active);
  const enabledFunctions = functions.filter(func => func.enabled);

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => {
      const newSelection = prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId];
      
      console.log('🔧 Account selection changed:', newSelection);
      return newSelection;
    });
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

  const handleSave = async () => {
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
      // FIXED: Count recipients properly
      const recipientCount = recipients.split(/[,\n;]/).filter(email => email.trim() && email.includes('@')).length;
      
      console.log('🔧 Saving campaign with:', {
        selectedAccounts,
        recipientCount,
        sendingMode
      });
      
      // FIXED: Properly construct config object
      const updatedConfig = {
        selectedAccounts: [...selectedAccounts], // Ensure it's a new array
        sendingMode,
        dispatchMethod,
        useCustomConfig,
        customFunctionCount: useCustomConfig ? customFunctionCount : enabledFunctions.length,
        customAccountCount: useCustomConfig ? customAccountCount : selectedAccounts.length,
        rotation: {
          useFromNameRotation,
          fromNames: useFromNameRotation 
            ? fromNameRotations.filter(name => name.trim()).join('\n')
            : '',
          useSubjectRotation,
          subjects: useSubjectRotation 
            ? subjectRotations.filter(subject => subject.trim()).join('\n')
            : ''
        },
        testAfter: {
          enabled: testAfterEnabled,
          email: testAfterEmail,
          count: testAfterCount
        }
      };

      const updates = {
        from_name: fromName,
        subject: subject,
        recipients: recipients,
        html_content: htmlContent,
        text_content: textContent,
        total_recipients: recipientCount,
        config: updatedConfig,
        // Reset status to draft if campaign was prepared (needs re-preparation)
        status: campaign.status === 'prepared' ? 'draft' : campaign.status
      };

      console.log('🔧 Updating campaign with:', updates);

      const result = await updateCampaign(campaign.id, updates);
      
      if (result) {
        setOpen(false);
        toast({
          title: "Success",
          description: `Campaign updated successfully! ${selectedAccounts.length} accounts selected, ${recipientCount} recipients.`
        });
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Error",
        description: `Failed to update campaign: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const recipientCount = recipients.split(/[,\n;]/).filter(email => email.trim() && email.includes('@')).length;
  const validFromNames = fromNameRotations.filter(name => name.trim());
  const validSubjects = subjectRotations.filter(subject => subject.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Modify your email campaign settings and content. Selected accounts and recipient count will be preserved.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="rotation">Rotation</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
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
                  className="min-h-[200px] font-mono"
                />
              </TabsContent>
              
              <TabsContent value="text" className="space-y-2">
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter your plain text email content here..."
                  className="min-h-[200px]"
                />
              </TabsContent>

              <TabsContent value="preview" className="space-y-2">
                <div className="border rounded-lg p-4 min-h-[200px] bg-white">
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
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Email Accounts Selection *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeAccounts.length === 0 ? (
                  <p className="text-gray-500">No active email accounts found.</p>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Sending Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Sending Mode</Label>
                    <Select value={sendingMode} onValueChange={setSendingMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zero-delay">Zero Delay (Max Speed)</SelectItem>
                        <SelectItem value="fast">Fast (0.5s delay)</SelectItem>
                        <SelectItem value="controlled">Controlled (2s delay)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Dispatch Method</Label>
                    <Select value={dispatchMethod} onValueChange={setDispatchMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parallel">Parallel (All functions)</SelectItem>
                        <SelectItem value="round-robin">Round Robin (Rotate accounts)</SelectItem>
                        <SelectItem value="sequential">Sequential</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Custom Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={useCustomConfig}
                      onCheckedChange={setUseCustomConfig}
                    />
                    <Label>Use Custom Limits</Label>
                  </div>

                  {useCustomConfig && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Functions to Use (max: {enabledFunctions.length})</Label>
                        <Input
                          type="number"
                          min="1"
                          max={enabledFunctions.length}
                          value={customFunctionCount}
                          onChange={(e) => setCustomFunctionCount(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Accounts to Use (max: {selectedAccounts.length})</Label>
                        <Input
                          type="number"
                          min="1"
                          max={selectedAccounts.length}
                          value={customAccountCount}
                          onChange={(e) => setCustomAccountCount(parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Test After Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={testAfterEnabled}
                    onCheckedChange={setTestAfterEnabled}
                  />
                  <Label>Enable Test After</Label>
                </div>

                {testAfterEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Test Email</Label>
                      <Input
                        type="email"
                        value={testAfterEmail}
                        onChange={(e) => setTestAfterEmail(e.target.value)}
                        placeholder="test@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Send Test Every X Emails</Label>
                      <Input
                        type="number"
                        min="1"
                        value={testAfterCount}
                        onChange={(e) => setTestAfterCount(parseInt(e.target.value) || 10)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rotation" className="space-y-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>FROM Name Rotation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={useFromNameRotation}
                      onCheckedChange={setUseFromNameRotation}
                    />
                    <Label>Enable FROM Name Rotation</Label>
                  </div>
                  
                  {useFromNameRotation && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>FROM Names (one per line - will rotate instead of main FROM name)</Label>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subject Rotation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={useSubjectRotation}
                      onCheckedChange={setUseSubjectRotation}
                    />
                    <Label>Enable Subject Rotation</Label>
                  </div>
                  
                  {useSubjectRotation && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Subject Lines (one per line - will rotate instead of main subject)</Label>
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm text-blue-800">
            <strong>Current Selection:</strong> {selectedAccounts.length} accounts, {recipientCount} recipients
            {sendingMode === 'zero-delay' && (
              <span className="ml-2 text-orange-600 font-medium">🚀 ZERO DELAY MODE</span>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !fromName || !subject || !recipients || selectedAccounts.length === 0}
          >
            {loading ? 'Saving...' : `Save Changes (${selectedAccounts.length} accounts, ${recipientCount} recipients)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignEditDialog;
