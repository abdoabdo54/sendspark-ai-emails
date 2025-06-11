
import { useGcfFunctions } from './useGcfFunctions';
import { useEmailAccounts } from './useEmailAccounts';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignData {
  from_name: string;
  subject: string;
  recipients: string;
  html_content: string;
  text_content: string;
  send_method: string;
  config: any;
}

export const useCampaignSender = (organizationId?: string) => {
  const { functions } = useGcfFunctions(organizationId);
  const { accounts } = useEmailAccounts(organizationId);
  
  const getAvailableResources = () => {
    const enabledFunctions = functions.filter(func => func.enabled);
    const activeAccounts = accounts.filter(account => account.is_active);
    
    return {
      functions: enabledFunctions,
      accounts: activeAccounts,
      hasFunctions: enabledFunctions.length > 0,
      hasAccounts: activeAccounts.length > 0
    };
  };

  const calculateCampaignSlicing = (recipients: string[], config: any) => {
    const { functions: enabledFunctions } = getAvailableResources();
    
    if (enabledFunctions.length === 0) {
      throw new Error('No enabled Cloud Functions available');
    }

    const totalRecipients = recipients.length;
    const emailsPerFunction = Math.ceil(totalRecipients / enabledFunctions.length);
    
    // Create slices for each function
    const slices = enabledFunctions.map((func, index) => {
      const skip = index * emailsPerFunction;
      const limit = Math.min(emailsPerFunction, totalRecipients - skip);
      
      return {
        functionId: func.id,
        functionUrl: func.url,
        functionName: func.name,
        skip,
        limit,
        recipients: recipients.slice(skip, skip + limit)
      };
    }).filter(slice => slice.limit > 0);

    return slices;
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    try {
      console.log('🚀 Starting parallel campaign dispatch...');
      
      // Parse recipients
      const recipients = campaignData.recipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      if (recipients.length === 0) {
        throw new Error('No valid recipients found');
      }

      // Create campaign in database
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert([{
          ...campaignData,
          organization_id: organizationId,
          status: 'processing',
          total_recipients: recipients.length,
          prepared_emails: recipients
        }])
        .select()
        .single();

      if (campaignError) {
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      console.log('📊 Campaign created with ID:', campaign.id);

      // Calculate slicing strategy
      const slices = calculateCampaignSlicing(recipients, campaignData.config);
      console.log(`📈 Campaign split into ${slices.length} parallel slices`);

      // Dispatch to all functions in parallel
      const dispatchPromises = slices.map(async (slice, index) => {
        const payload = {
          campaignId: campaign.id,
          slice: {
            skip: slice.skip,
            limit: slice.limit,
            recipients: slice.recipients
          },
          campaignData: {
            from_name: campaignData.from_name,
            subject: campaignData.subject,
            html_content: campaignData.html_content,
            text_content: campaignData.text_content,
            config: campaignData.config
          },
          accounts: getAvailableResources().accounts,
          organizationId
        };

        console.log(`🎯 Dispatching slice ${index + 1} to ${slice.functionName} (${slice.limit} emails)`);

        try {
          const response = await fetch(slice.functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`Function ${slice.functionName} returned ${response.status}`);
          }

          const result = await response.json();
          console.log(`✅ Slice ${index + 1} completed successfully`);
          return result;
        } catch (error) {
          console.error(`❌ Slice ${index + 1} failed:`, error);
          throw error;
        }
      });

      // Wait for all slices to complete
      const results = await Promise.allSettled(dispatchPromises);
      
      // Count successful vs failed slices
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📈 Campaign dispatch complete: ${successful} successful, ${failed} failed`);

      // Update campaign status
      await supabase
        .from('email_campaigns')
        .update({
          status: failed === 0 ? 'completed' : 'partially_completed',
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      return {
        campaignId: campaign.id,
        totalSlices: slices.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('❌ Campaign dispatch failed:', error);
      throw error;
    }
  };

  return {
    ...getAvailableResources(),
    sendCampaign,
    calculateCampaignSlicing
  };
};
