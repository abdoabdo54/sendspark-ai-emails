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
    
    // Use custom function count from config if specified
    const functionsToUse = config.useCustomConfig && config.customFunctionCount 
      ? Math.min(config.customFunctionCount, enabledFunctions.length)
      : enabledFunctions.length;
    
    console.log(`📊 DISTRIBUTION: Using ${functionsToUse} functions for ${totalRecipients} emails`);
    
    // Ensure minimum 1 email per function, otherwise reduce function count
    const actualFunctionsToUse = Math.min(functionsToUse, totalRecipients);
    const emailsPerFunction = Math.ceil(totalRecipients / actualFunctionsToUse);
    
    console.log(`📈 FINAL: ${totalRecipients} emails distributed across ${actualFunctionsToUse} functions (${emailsPerFunction} each)`);
    
    // Create slices for the actual number of functions that will be used
    const functionsToUseList = enabledFunctions.slice(0, actualFunctionsToUse);
    
    const slices = functionsToUseList.map((func, index) => {
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

    console.log(`🎯 FINAL DISTRIBUTION: ${slices.length} functions will be used:`, 
      slices.map(s => `${s.functionName}(${s.limit} emails)`));

    return slices;
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    try {
      console.log('🚀 SENDING: Starting prepared campaign dispatch:', campaignData.config);
      
      // Find existing prepared campaign
      const { data: existingCampaigns, error: findError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('from_name', campaignData.from_name)
        .eq('subject', campaignData.subject)
        .eq('status', 'prepared')
        .order('created_at', { ascending: false })
        .limit(1);

      if (findError) {
        console.error('❌ Error finding prepared campaign:', findError);
        throw new Error(`Failed to find prepared campaign: ${findError.message}`);
      }

      if (!existingCampaigns || existingCampaigns.length === 0) {
        throw new Error('No prepared campaign found. Please prepare the campaign first.');
      }

      const campaign = existingCampaigns[0];
      console.log('📊 Found prepared campaign with ID:', campaign.id);
      console.log('📧 Prepared emails count:', campaign.prepared_emails?.length || 0);

      if (!campaign.prepared_emails || campaign.prepared_emails.length === 0) {
        throw new Error('Campaign has no prepared emails. Please prepare the campaign again.');
      }

      // Update campaign status to sending
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id);

      if (updateError) {
        console.error('❌ Failed to update campaign status:', updateError);
        throw new Error(`Failed to update campaign status: ${updateError.message}`);
      }

      // Get selected accounts from config
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      console.log('📧 Selected account IDs from config:', selectedAccountIds);
      
      const selectedAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && account.is_active
      );

      console.log('📧 Active accounts for sending:', selectedAccounts.length, selectedAccounts.map(a => ({ id: a.id, name: a.name })));

      if (selectedAccounts.length === 0) {
        throw new Error('No valid accounts selected');
      }

      // Use prepared emails count for distribution
      const totalEmails = campaign.prepared_emails.length;
      
      // Calculate proper slicing strategy using prepared email count
      const slices = calculateCampaignSlicing(campaign.prepared_emails, campaignData.config);
      console.log(`📈 Campaign distributed across ${slices.length} functions`);

      // Use custom account count if specified
      const accountsToUse = campaignData.config.useCustomConfig && campaignData.config.customAccountCount
        ? Math.min(campaignData.config.customAccountCount, selectedAccounts.length)
        : selectedAccounts.length;
      
      const accountsForSending = selectedAccounts.slice(0, accountsToUse);
      
      console.log(`📧 Using ${accountsForSending.length} accounts:`, accountsForSending.map(a => a.name));

      // Configure accounts based on sending mode (ZERO DELAY = NO LIMITS)
      const gcfAccounts = accountsForSending.map(account => {
        const cleanConfig = { ...account.config };
        
        if (campaignData.config.sendingMode === 'zero-delay') {
          // ZERO DELAY = NO LIMITS AT ALL
          delete cleanConfig.emails_per_hour;
          delete cleanConfig.emails_per_second;
          delete cleanConfig.delay_in_seconds;
          delete cleanConfig.rate_limit_enabled;
          cleanConfig.zero_delay_mode = true;
          console.log(`🚀 ZERO DELAY: Removed ALL rate limits for ${account.name}`);
        } else if (campaignData.config.sendingMode === 'fast') {
          // FAST = Minimal delays
          cleanConfig.emails_per_hour = 7200; // 2 per second
          cleanConfig.delay_in_seconds = 0.5;
          cleanConfig.rate_limit_enabled = false;
          console.log(`⚡ FAST MODE: Minimal delays for ${account.name}`);
        } else {
          // CONTROLLED = Standard rates
          cleanConfig.emails_per_hour = 3600; // 1 per second
          cleanConfig.delay_in_seconds = 1;
          cleanConfig.rate_limit_enabled = true;
          console.log(`🔧 CONTROLLED: Standard rates for ${account.name}`);
        }

        return {
          id: account.id,
          name: account.name,
          email: account.email,
          type: account.type,
          config: cleanConfig
        };
      });

      // Dispatch to ALL selected functions with prepared data
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
            config: {
              ...campaignData.config,
              sendingMode: campaignData.config.sendingMode,
              dispatchMethod: campaignData.config.dispatchMethod,
              zeroDelayMode: campaignData.config.sendingMode === 'zero-delay',
              bypassRateLimits: campaignData.config.sendingMode === 'zero-delay'
            }
          },
          accounts: gcfAccounts,
          organizationId
        };

        console.log(`🎯 DISPATCHING to ${slice.functionName}: ${slice.limit} emails with ${campaignData.config.sendingMode} mode`);

        try {
          const response = await fetch(slice.functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Function ${slice.functionName} failed: ${response.status} - ${errorText}`);
            throw new Error(`Function ${slice.functionName} returned ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ Function ${slice.functionName} completed:`, result);
          return result;
        } catch (error) {
          console.error(`❌ Function ${slice.functionName} error:`, error);
          throw error;
        }
      });

      // Wait for ALL functions to complete
      const results = await Promise.allSettled(dispatchPromises);
      
      // Count successful vs failed functions
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📈 DISPATCH COMPLETE: ${successful} functions succeeded, ${failed} functions failed`);

      // Update campaign status based on results
      const finalStatus = failed === 0 ? 'sent' : (successful > 0 ? 'sent' : 'failed');
      
      await supabase
        .from('email_campaigns')
        .update({
          status: finalStatus,
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          ...(failed > 0 && { error_message: `${failed} out of ${slices.length} functions failed` })
        })
        .eq('id', campaign.id);

      return {
        campaignId: campaign.id,
        totalSlices: slices.length,
        successful,
        failed,
        functionsUsed: slices.map(s => s.functionName),
        results: results.map((result, index) => ({
          functionName: slices[index].functionName,
          emailCount: slices[index].limit,
          status: result.status,
          ...(result.status === 'fulfilled' ? { data: result.value } : { error: result.reason?.message })
        }))
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
