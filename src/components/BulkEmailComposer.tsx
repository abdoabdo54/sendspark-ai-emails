
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Mail, Send, Upload, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from '@/hooks/use-toast';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer = ({ onSend }: BulkEmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading: accountsLoading, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [formData, setFormData] = useState({
    from_name: '',
    subject: '',
    recipients: '',
    html_content: '',
    text_content: '',
    send_method: 'bulk',
    email_account_id: '',
    config: {
      delay_between_emails: 1,
      max_emails_per_hour: 100,
      selectedAccounts: [] as string[],
      // Rotation settings
      useFromNameRotation: false,
      fromNames: [] as string[],
      useSubjectRotation: false,
      subjects: [] as string[],
      // Test after settings
      useTestAfter: false,
      testAfterEmail: '',
      testAfterCount: 100
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [newFromName, setNewFromName] = useState('');
  const [newSubject, setNewSubject] = useState('');

  // Update recipient count when recipients change
  useEffect(() => {
    if (formData.recipients.trim()) {
      const emails = formData.recipients
        .split(/[\n,]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.length > 3);
      
      setRecipientCount(emails.length);
    } else {
      setRecipientCount(0);
    }
  }, [formData.recipients]);

  // Force refresh accounts when component mounts or organization changes
  useEffect(() => {
    if (currentOrganization?.id) {
      refetch();
    }
  }, [currentOrganization?.id, refetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization first",
        variant: "destructive"
      });
      return;
    }

    if (recipientCount === 0) {
      toast({
        title: "Error",
        description: "Please add valid email recipients",
        variant: "destructive"
      });
      return;
    }

    // Validation for rotation settings
    if (formData.config.useFromNameRotation && formData.config.fromNames.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one from name for rotation",
        variant: "destructive"
      });
      return;
    }

    if (formData.config.useSubjectRotation && formData.config.subjects.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one subject for rotation",
        variant: "destructive"
      });
      return;
    }

    // Validation for test after settings
    if (formData.config.useTestAfter) {
      if (!formData.config.testAfterEmail || !formData.config.testAfterEmail.includes('@')) {
        toast({
          title: "Error",
          description: "Please provide a valid test email address",
          variant: "destructive"
        });
        return;
      }
      if (formData.config.testAfterCount <= 0) {
        toast({
          title: "Error",
          description: "Test after count must be greater than 0",
          variant: "destructive"
        });
        return;
      }
    }

    // Use all accounts when no specific selection or use selected accounts
    const accountsToUse = formData.config.selectedAccounts.length > 0 
      ? formData.config.selectedAccounts 
      : accounts.map(acc => acc.id);

    if (accountsToUse.length === 0) {
      toast({
        title: "Error",
        description: "No email accounts available",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const emailList = formData.recipients
        .split(/[\n,]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.length > 3);

      const campaignData = {
        from_name: formData.from_name || '', // Can be empty if using rotation
        subject: formData.subject || '', // Can be empty if using rotation
        recipients: emailList.join(','),
        html_content: formData.html_content,
        text_content: formData.text_content,
        send_method: formData.send_method,
        total_recipients: recipientCount,
        organization_id: currentOrganization.id,
        config: {
          ...formData.config,
          selectedAccounts: accountsToUse,
          // Ensure rotation data is included
          useFromNameRotation: formData.config.useFromNameRotation,
          fromNames: formData.config.fromNames,
          useSubjectRotation: formData.config.useSubjectRotation,
          subjects: formData.config.subjects,
          // Test after configuration
          useTestAfter: formData.config.useTestAfter,
          testAfterEmail: formData.config.testAfterEmail,
          testAfterCount: formData.config.testAfterCount
        }
      };

      await onSend(campaignData);
      
      // Reset form after successful send
      setFormData({
        from_name: '',
        subject: '',
        recipients: '',
        html_content: '',
        text_content: '',
        send_method: 'bulk',
        email_account_id: '',
        config: {
          delay_between_emails: 1,
          max_emails_per_hour: 100,
          selectedAccounts: [],
          useFromNameRotation: false,
          fromNames: [],
          useSubjectRotation: false,
          subjects: [],
          useTestAfter: false,
          testAfterEmail: '',
          testAfterCount: 100
        }
      });

      toast({
        title: "Success",
        description: `Campaign created successfully with ${recipientCount} recipients!`
      });

    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFormData(prev => ({ ...prev, recipients: content }));
        toast({
          title: "Success",
          description: "Email list uploaded successfully"
        });
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Error",
        description: "Please upload a valid text file",
        variant: "destructive"
      });
    }
  };

  const handleRefreshAccounts = () => {
    refetch();
    toast({
      title: "Refreshing",
      description: "Checking for new email accounts..."
    });
  };

  const handleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        selectedAccounts: prev.config.selectedAccounts.includes(accountId)
          ? prev.config.selectedAccounts.filter(id => id !== accountId)
          : [...prev.config.selectedAccounts, accountId]
      }
    }));
  };

  const addFromName = () => {
    if (newFromName.trim()) {
      setFormData(prev => ({
        ...prev,
        config: {
          ...prev.config,
          fromNames: [...prev.config.fromNames, newFromName.trim()]
        }
      }));
      setNewFromName('');
    }
  };

  const removeFromName = (index: number) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        fromNames: prev.config.fromNames.filter((_, i) => i !== index)
      }
    }));
  };

  const addSubject = () => {
    if (newSubject.trim()) {
      setFormData(prev => ({
        ...prev,
        config: {
          ...prev.config,
          subjects: [...prev.config.subjects, newSubject.trim()]
        }
      }));
      setNewSubject('');
    }
  };

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        subjects: prev.config.subjects.filter((_, i) => i !== index)
      }
    }));
  };

  if (!currentOrganization?.id) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select an organization to create email campaigns.
        </AlertDescription>
      </Alert>
    );
  }

  const isButtonDisabled = isSubmitting || recipientCount === 0;
  const getDisabledReason = () => {
    if (isSubmitting) return "Creating campaign...";
    if (recipientCount === 0) return "Add email recipients";
    return "";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Accounts 
            </div>
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={handleRefreshAccounts}
              disabled={accountsLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${accountsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Select specific accounts or leave empty to use all available accounts ({accounts.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-slate-600">Loading email accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No email accounts found for organization "{currentOrganization.name}". Please add an email account first in the Accounts section.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Account Selection (Optional)</Label>
                <p className="text-xs text-slate-500 mb-2">
                  {formData.config.selectedAccounts.length === 0 
                    ? `All ${accounts.length} accounts will be used for rotation` 
                    : `${formData.config.selectedAccounts.length} selected accounts will be used`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {accounts.map((account) => (
                    <div 
                      key={account.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.config.selectedAccounts.includes(account.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleAccountSelection(account.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{account.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {account.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{account.email}</p>
                        </div>
                        {formData.config.selectedAccounts.includes(account.id) && (
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Details with Rotation Options */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Configure your email campaign settings and rotation options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From Name Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.config.useFromNameRotation}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, useFromNameRotation: checked }
                }))}
              />
              <Label>Use From Name Rotation</Label>
            </div>
            
            {formData.config.useFromNameRotation ? (
              <div className="space-y-2">
                <Label>From Names for Rotation</Label>
                <div className="flex gap-2">
                  <Input
                    value={newFromName}
                    onChange={(e) => setNewFromName(e.target.value)}
                    placeholder="Enter from name"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFromName())}
                  />
                  <Button type="button" onClick={addFromName} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.config.fromNames.map((name, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => removeFromName(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  value={formData.from_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                  placeholder="Your Company"
                />
              </div>
            )}
          </div>

          {/* Subject Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.config.useSubjectRotation}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, useSubjectRotation: checked }
                }))}
              />
              <Label>Use Subject Rotation</Label>
            </div>
            
            {formData.config.useSubjectRotation ? (
              <div className="space-y-2">
                <Label>Subjects for Rotation</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Enter subject line"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                  />
                  <Button type="button" onClick={addSubject} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.config.subjects.map((subject, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {subject}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => removeSubject(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Your email subject"
                />
              </div>
            )}
          </div>

          {/* Test After Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.config.useTestAfter}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, useTestAfter: checked }
                }))}
              />
              <Label>Enable Test After</Label>
            </div>
            
            {formData.config.useTestAfter && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="testAfterEmail">Test Email Address</Label>
                  <Input
                    id="testAfterEmail"
                    type="email"
                    value={formData.config.testAfterEmail}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, testAfterEmail: e.target.value }
                    }))}
                    placeholder="test@gmail.com"
                  />
                </div>
                <div>
                  <Label htmlFor="testAfterCount">Send Test After Every</Label>
                  <Input
                    id="testAfterCount"
                    type="number"
                    min="1"
                    value={formData.config.testAfterCount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, testAfterCount: parseInt(e.target.value) || 100 }
                    }))}
                    placeholder="500"
                  />
                  <p className="text-xs text-slate-500 mt-1">emails sent</p>
                </div>
              </div>
            )}
          </div>

          {/* Rate Limiting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delay">Delay Between Emails (seconds)</Label>
              <Input
                id="delay"
                type="number"
                min="1"
                value={formData.config.delay_between_emails}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, delay_between_emails: parseInt(e.target.value) || 1 }
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="max_emails">Max Emails per Hour</Label>
              <Input
                id="max_emails"
                type="number"
                min="1"
                value={formData.config.max_emails_per_hour}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, max_emails_per_hour: parseInt(e.target.value) || 100 }
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recipients
            <Badge variant={recipientCount > 0 ? "default" : "outline"}>
              {recipientCount} emails
            </Badge>
          </CardTitle>
          <CardDescription>
            Add email addresses (one per line or comma-separated) or upload a text file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </Button>
          </div>
          
          <Textarea
            value={formData.recipients}
            onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
            placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
            rows={6}
            required
          />
          
          {recipientCount > 0 && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
              ✓ {recipientCount} valid email addresses detected
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Content */}
      <Card>
        <CardHeader>
          <CardTitle>Email Content</CardTitle>
          <CardDescription>
            Create your email message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="html_content">HTML Content</Label>
            <Textarea
              id="html_content"
              value={formData.html_content}
              onChange={(e) => setFormData(prev => ({ ...prev, html_content: e.target.value }))}
              placeholder="<h1>Hello!</h1><p>Your HTML email content here...</p>"
              rows={8}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="text_content">Plain Text Content (optional)</Label>
            <Textarea
              id="text_content"
              value={formData.text_content}
              onChange={(e) => setFormData(prev => ({ ...prev, text_content: e.target.value }))}
              placeholder="Plain text version of your email..."
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <div className="space-y-2">
          {isButtonDisabled && (
            <p className="text-sm text-red-500 text-right">
              {getDisabledReason()}
            </p>
          )}
          <Button 
            type="submit" 
            disabled={isButtonDisabled}
            className="min-w-32"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Campaign ({recipientCount} emails)
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default BulkEmailComposer;
