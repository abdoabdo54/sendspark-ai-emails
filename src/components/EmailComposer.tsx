
import { useState } from 'react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from 'sonner';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'bulk' }: EmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { sendCampaign, hasFunctions, hasAccounts } = useCampaignSender(currentOrganization?.id);

  const handleBulkEmailSend = async (campaignData: any) => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    // Validation checks
    if (!hasFunctions) {
      toast.error('No Google Cloud Functions configured. Please add at least one function in the Function Manager.');
      return;
    }

    if (!hasAccounts) {
      toast.error('No active email accounts found. Please configure email accounts first.');
      return;
    }

    if (!campaignData.config?.selectedAccounts?.length) {
      toast.error('No email accounts selected. Please select at least one account.');
      return;
    }

    try {
      console.log('Creating and sending campaign with data:', campaignData);
      
      // Parse recipients to validate
      const recipients = campaignData.recipients
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);
      
      if (recipients.length === 0) {
        toast.error('No valid recipients found');
        return;
      }

      toast.info(`Starting campaign to ${recipients.length} recipients...`);
      
      // Send the campaign using Google Cloud Functions
      const result = await sendCampaign({
        from_name: campaignData.from_name,
        subject: campaignData.subject,
        recipients: campaignData.recipients,
        html_content: campaignData.html_content || '',
        text_content: campaignData.text_content || '',
        send_method: campaignData.send_method || 'bulk',
        config: campaignData.config || {}
      });

      console.log('Campaign dispatch result:', result);
      
      if (result.successful > 0) {
        toast.success(`Campaign dispatched successfully! ${result.successful}/${result.totalSlices} functions completed.`);
      } else {
        toast.error(`Campaign failed: All ${result.failed} functions encountered errors.`);
      }

    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error(`Campaign failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSingleEmailSend = async (emailData: any) => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      console.log('Sending single email:', emailData);
      toast.info('Single email functionality not yet implemented for Google Cloud Functions');
    } catch (error) {
      console.error('Error sending single email:', error);
      toast.error('Failed to send single email');
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
