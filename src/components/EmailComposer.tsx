
import { useState } from 'react';
import CampaignComposer from './CampaignComposer';
import SingleEmailComposer from './SingleEmailComposer';
import CampaignTesting from './CampaignTesting';
import AccountManager from './AccountManager';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from 'sonner';

interface EmailComposerProps {
  activeTab?: string;
}

const EmailComposer = ({ activeTab = 'campaign' }: EmailComposerProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { createCampaign } = useCampaigns(currentOrganization?.id);

  const handleCampaignSend = async (campaignData: any) => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      console.log('🚀 Creating campaign (draft status) with data:', campaignData);
      console.log('📧 Selected accounts:', campaignData.selected_accounts);
      console.log('🔧 Send method:', campaignData.send_method);
      console.log('🖥️ PowerMTA server:', campaignData.selected_powermta_server);
      
      // CRITICAL VALIDATION: Check if accounts are selected
      if (!campaignData.selected_accounts || campaignData.selected_accounts.length === 0) {
        toast.error('Please select at least one email account before creating the campaign');
        return;
      }
      
      // Parse recipients to get total count
      const recipients = campaignData.recipients
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);
      
      if (recipients.length === 0) {
        toast.error('No valid recipients found');
        return;
      }

      // Ensure selected_accounts is properly included in the campaign data
      const config = {
        ...campaignData.config,
        selected_accounts: campaignData.selected_accounts,
        selected_powermta_server: campaignData.selected_powermta_server
      };

      // Create campaign as DRAFT (not sending immediately)
      const newCampaign = await createCampaign({
        from_name: campaignData.from_rotation?.[0]?.name || '',
        subject: campaignData.subject_rotation?.[0] || '',
        recipients: campaignData.recipients,
        html_content: campaignData.html_content || '',
        text_content: campaignData.text_content || '',
        send_method: campaignData.send_method || 'cloud-functions',
        selected_accounts: campaignData.selected_accounts, // CRITICAL: Pass this through
        selected_powermta_server: campaignData.selected_powermta_server || undefined,
        status: 'draft',
        sent_count: 0,
        total_recipients: recipients.length,
        config: config
      });

      if (newCampaign) {
        console.log('✅ Campaign created successfully:', newCampaign.id);
        console.log('📋 Campaign includes accounts:', newCampaign.selected_accounts);
        toast.success(`Campaign created successfully! Go to Campaign History to prepare and send.`);
      } else {
        throw new Error('Failed to create campaign');
      }

    } catch (error) {
      console.error('❌ Error creating campaign:', error);
      toast.error(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSingleEmailSend = async (emailData: any) => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      console.log('Creating single email campaign:', emailData);
      toast.info('Single email functionality - creating as campaign draft');
      
      // Convert single email to campaign format
      await handleCampaignSend({
        ...emailData,
        recipients: emailData.to || '',
        send_method: 'single'
      });
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
      case 'campaign':
        return <CampaignComposer onSend={handleCampaignSend} />;
      case 'single':
        return <SingleEmailComposer onSend={handleSingleEmailSend} />;
      case 'testing':
        return <CampaignTesting />;
      case 'accounts':
        return <AccountManager />;
      default:
        return <CampaignComposer onSend={handleCampaignSend} />;
    }
  };

  return (
    <div className="w-full">
      {renderContent()}
    </div>
  );
};

export default EmailComposer;
