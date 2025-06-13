
import { useState } from 'react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from 'sonner';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'bulk' }: EmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { createCampaign } = useCampaigns(currentOrganization?.id);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkEmailSend = async (campaignData: any) => {
    if (isProcessing) {
      console.log('Campaign already processing, ignoring duplicate request');
      return;
    }

    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    // Basic validation
    if (!campaignData.config?.selectedAccounts?.length) {
      toast.error('No email accounts selected. Please select at least one account.');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Creating campaign with data:', campaignData);
      
      // Parse recipients to get count
      const recipients = campaignData.recipients
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);
      
      if (recipients.length === 0) {
        toast.error('No valid recipients found');
        return;
      }

      // Create the campaign in draft status
      const campaign = await createCampaign({
        from_name: campaignData.from_name,
        subject: campaignData.subject,
        recipients: campaignData.recipients,
        html_content: campaignData.html_content || '',
        text_content: campaignData.text_content || '',
        send_method: campaignData.send_method || 'bulk',
        status: 'draft',
        sent_count: 0,
        total_recipients: recipients.length,
        config: campaignData.config || {}
      });

      if (campaign) {
        toast.success(`Campaign created successfully with ${recipients.length} recipients!`);
      }

    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleEmailSend = async (emailData: any) => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      console.log('Creating single email campaign:', emailData);
      
      const campaign = await createCampaign({
        from_name: emailData.from_name,
        subject: emailData.subject,
        recipients: emailData.recipients,
        html_content: emailData.html_content || '',
        text_content: emailData.text_content || '',
        send_method: 'single',
        status: 'draft',
        sent_count: 0,
        total_recipients: 1,
        config: emailData.config || {}
      });

      if (campaign) {
        toast.success('Single email campaign created successfully!');
      }
    } catch (error) {
      console.error('Error creating single email campaign:', error);
      toast.error('Failed to create single email campaign');
    }
  };

  if (!currentOrganization?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-600">Please select an organization to continue.</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'bulk':
        return <BulkEmailComposer onSend={handleBulkEmailSend} />;
      case 'single':
        return <SingleEmailComposer onSend={handleSingleEmailSend} />;
      case 'testing':
        return <CampaignTesting />;
      case 'analytics':
        return <CampaignAnalytics />;
      case 'accounts':
        return <AccountManager />;
      default:
        return <BulkEmailComposer onSend={handleBulkEmailSend} />;
    }
  };

  return (
    <div className="w-full">
      {renderContent()}
    </div>
  );
};

export default EmailComposer;
