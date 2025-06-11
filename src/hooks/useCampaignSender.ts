
import { useGcfFunctions } from './useGcfFunctions';
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
  
  // Get available functions - either configured functions or fallback
  const getAvailableFunctions = () => {
    const enabledFunctions = functions.filter(func => func.enabled);
    
    if (enabledFunctions.length > 0) {
      return enabledFunctions;
    }
    
    // Fallback to legacy function
    return [{
      id: 'legacy',
      name: 'Legacy Function',
      url: 'https://us-central1-alpin-4d67f.cloudfunctions.net/sendEmailCampaign',
      enabled: true
    }];
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    try {
      console.log('Sending campaign with data:', campaignData);
      
      // Create campaign in database first
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert([{
          ...campaignData,
          organization_id: organizationId,
          status: 'draft'
        }])
        .select()
        .single();

      if (campaignError) {
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      // Send via the appropriate function
      const { data: result, error: sendError } = await supabase.functions.invoke('send-campaign', {
        body: { campaignId: campaign.id }
      });

      if (sendError) {
        throw new Error(`Failed to send campaign: ${sendError.message}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending campaign:', error);
      throw error;
    }
  };

  return {
    availableFunctions: getAvailableFunctions(),
    sendCampaign
  };
};
