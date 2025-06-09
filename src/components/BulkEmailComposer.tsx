
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Mail, Send, Upload, RefreshCw } from 'lucide-react';
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
      selectedAccounts: [] as string[]
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  // Update recipient count when recipients change - FIXED PARSING
  useEffect(() => {
    if (formData.recipients.trim()) {
      // Split by newlines and commas, then filter valid emails
      const emails = formData.recipients
        .split(/[\n,]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.length > 3);
      
      console.log('Parsed emails:', emails);
      setRecipientCount(emails.length);
    } else {
      setRecipientCount(0);
    }
  }, [formData.recipients]);

  // Force refresh accounts when component mounts or organization changes
  useEffect(() => {
    if (currentOrganization?.id) {
      console.log('BulkEmailComposer: Organization changed, refreshing accounts for:', currentOrganization.id);
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

    setIsSubmitting(true);

    try {
      // Properly format recipients as comma-separated for database storage
      const emailList = formData.recipients
        .split(/[\n,]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@') && email.length > 3);

      const campaignData = {
        ...formData,
        recipients: emailList.join(','), // Store as comma-separated string
        total_recipients: recipientCount,
        organization_id: currentOrganization.id,
        config: {
          ...formData.config,
          selectedAccounts: formData.config.selectedAccounts.length > 0 
            ? formData.config.selectedAccounts 
            : formData.email_account_id ? [formData.email_account_id] : []
        }
      };

      console.log('Creating campaign with:', recipientCount, 'recipients');
      console.log('Email list:', emailList);

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
          selectedAccounts: []
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
    console.log('Manual account refresh triggered');
    refetch();
    toast({
      title: "Refreshing",
      description: "Checking for new email accounts..."
    });
  };

  // Handle account selection for multi-account campaigns
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
            Select email accounts for sending. Total accounts: {accounts.length}
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
              {/* Multi-account selection */}
              <div>
                <Label className="text-sm font-medium">Select Accounts for Campaign</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
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
                
                {formData.config.selectedAccounts.length > 0 && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {formData.config.selectedAccounts.length} account(s) selected for rotation
                  </div>
                )}
              </div>

              {/* Debug info */}
              <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded">
                Debug: Organization ID: {currentOrganization.id} | Accounts found: {accounts.length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Configure your email campaign settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                value={formData.from_name}
                onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                placeholder="Your Company"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Your email subject"
                required
              />
            </div>
          </div>

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
        <Button 
          type="submit" 
          disabled={isSubmitting || recipientCount === 0 || formData.config.selectedAccounts.length === 0}
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
    </form>
  );
};

export default BulkEmailComposer;
