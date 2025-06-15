import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Loader2, FileText, Users, Settings, Zap } from 'lucide-react';
import AdvancedConfigurationPanel from './AdvancedConfigurationPanel';
import CompactAccountSelector from './CompactAccountSelector';
import CampaignSendMethodSelector from './CampaignSendMethodSelector';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer: React.FC<BulkEmailComposerProps> = ({ onSend }) => {
  const { currentOrganization } = useSimpleOrganizations();
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [advancedConfig, setAdvancedConfig] = useState<any>({});
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const recipientCount = recipients.split('\n').filter(email => email.trim()).length;

  const handleSend = async () => {
    if (!fromName || !subject || !recipients) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one email account');
      return;
    }

    setSending(true);
    
    try {
      const campaignData = {
        from_name: fromName,
        subject,
        recipients,
        html_content: htmlContent,
        text_content: textContent,
        send_method: sendMethod,
        config: {
          ...advancedConfig,
          selectedAccounts,
          sendMethod
        }
      };

      await onSend(campaignData);
      
      // Reset form after successful creation
      setFromName('');
      setSubject('');
      setRecipients('');
      setHtmlContent('');
      setTextContent('');
    } catch (error) {
      console.error('Campaign creation failed:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Create Email Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Campaign Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="Your Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Your email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Recipients */}
          <div>
            <Label htmlFor="recipients">
              Recipients 
              {recipientCount > 0 && <Badge variant="secondary" className="ml-2">{recipientCount} emails</Badge>}
            </Label>
            <Textarea
              id="recipients"
              placeholder="Enter email addresses (one per line or comma-separated)"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              rows={4}
              required
            />
          </div>

          <Separator />

          {/* Send Method Selection */}
          <CampaignSendMethodSelector
            selectedMethod={sendMethod}
            onMethodChange={setSendMethod}
            powerMTAAvailable={false}
          />

          <Separator />

          {/* Account Selection */}
          <CompactAccountSelector
            selectedAccounts={selectedAccounts}
            onAccountsChange={setSelectedAccounts}
          />

          <Separator />

          {/* Email Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Email Content</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="w-4 h-4 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>
            </div>

            <div>
              <Label htmlFor="html_content">HTML Content</Label>
              <Textarea
                id="html_content"
                placeholder="<h1>Hello!</h1><p>Your HTML email content here...</p>"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={8}
              />
            </div>

            <div>
              <Label htmlFor="text_content">Plain Text Content (Optional)</Label>
              <Textarea
                id="text_content"
                placeholder="Your plain text email content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* Advanced Configuration */}
          {showAdvanced && (
            <>
              <Separator />
              <AdvancedConfigurationPanel
                config={advancedConfig}
                onConfigChange={setAdvancedConfig}
              />
            </>
          )}

          <Separator />

          {/* Send Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={sending || !fromName || !subject || !recipients || selectedAccounts.length === 0}
              size="lg"
              className="min-w-[200px]"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create Campaign Draft
                </>
              )}
            </Button>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Note:</strong> This will create a campaign draft. Go to Campaign History to prepare and send your campaign.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
