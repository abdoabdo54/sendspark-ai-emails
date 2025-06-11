
import { useState } from 'react';
import BulkEmailComposer from './BulkEmailComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignAnalytics from './CampaignAnalytics';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'bulk' }: EmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { createCampaign } = useCampaigns(currentOrganization?.id);

  const handleBulkEmailSend = async (campaignData: any) => {
    if (!currentOrganization?.id) {
      console.error('No organization selected');
      return;
    }

    try {
      console.log('Creating campaign with data:', campaignData);
      
      // Parse recipients to get total count
      const recipients = campaignData.recipients
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);
      
      // Create the campaign with all required properties
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
        config: campaignData.config || {},
        prepared_emails: [],
        sent_at: undefined,
        error_message: undefined,
        completed_at: undefined
      });

      console.log('Campaign created successfully:', campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleSingleEmailSend = async (emailData: any) => {
    if (!currentOrganization?.id) {
      console.error('No organization selected');
      return;
    }

    try {
      console.log('Sending single email:', emailData);
      // Handle single email sending if needed
    } catch (error) {
      console.error('Error sending single email:', error);
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
