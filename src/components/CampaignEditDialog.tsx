
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
import { Plus, Trash2, Edit } from 'lucide-react';
import { Campaign, useCampaigns } from '@/hooks/useCampaigns';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useOrganizations } from '@/hooks/useOrganizations';
import { toast } from '@/hooks/use-toast';

interface CampaignEditDialogProps {
  campaign: Campaign;
  trigger?: React.ReactNode;
}

const CampaignEditDialog = ({ campaign, trigger }: CampaignEditDialogProps) => {
  const { currentOrganization } = useOrganizations();
  const { updateCampaign } = useCampaigns(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);

  const [open, setOpen] = useState(false);
  const [fromName, setFromName] = useState(campaign.from_name);
  const [subject, setSubject] = useState(campaign.subject);
  const [recipients, setRecipients] = useState(campaign.recipients);
  const [htmlContent, setHtmlContent] = useState(campaign.html_content || '');
  const [textContent, setTextContent] = useState(campaign.text_content || '');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(campaign.config?.selectedAccounts || []);
  const [sendingMethod, setSendingMethod] = useState(campaign.config?.sendingMethod || 'sequential');
  
  // Rotation settings
  const [useRotation, setUseRotation] = useState(campaign.config?.rotation?.useRotation || false);
  const [rotationFromNames, setRotationFromNames] = useState<string[]>(campaign.config?.rotation?.fromNames || ['']);
  const [rotationSubjects, setRotationSubjects] = useState<string[]>(campaign.config?.rotation?.subjects || ['']);
  
  const [loading, setLoading] = useState(false);

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
      const recipientCount = recipients.split(',').filter(email => email.trim()).length;
      
      const updatedConfig = {
        selectedAccounts,
        sendingMethod,
        rotation: {
          useRotation,
          fromNames: useRotation ? rotationFromNames.filter(name => name.trim()) : [],
          subjects: useRotation ? rotationSubjects.filter(subject => subject.trim()) : []
        }
      };

      const updates = {
        from_name: fromName,
        subject: subject,
        recipients: recipients,
        html_content: htmlContent,
        text_content: textContent,
        total_recipients: recipientCount,
        config: updatedConfig
      };

      await updateCampaign(campaign.id, updates);
      
      setOpen(false);
      
      toast({
        title: "Success",
        description: "Campaign updated successfully!"
      });
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

  const recipientCount = recipients.split(',').filter(email => email.trim()).length;
  const validFromNames = rotationFromNames.filter(name => name.trim());
  const validSubjects = rotationSubjects.filter(subject => subject.trim());

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Modify your email campaign settings and content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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

          {/* Email Accounts Selection */}
          <div className="space-y-3">
            <Label>Email Accounts *</Label>
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
                        <SelectItem value="sequential">Sequential (use first account)</SelectItem>
                        <SelectItem value="round-robin">Round Robin (rotate accounts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Rotation */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label>Content Rotation</Label>
              <Switch
                checked={useRotation}
                onCheckedChange={setUseRotation}
              />
            </div>
            
            {useRotation && (
              <div className="space-y-4 border rounded-lg p-4">
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
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading || !fromName || !subject || !recipients || selectedAccounts.length === 0}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignEditDialog;
