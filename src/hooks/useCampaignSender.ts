
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

interface PreparedEmail {
  to: string;
  from_name: string;
  subject: string;
  html_content: string;
  text_content: string;
  prepared_at: string;
  rotation_index?: number;
}

// Type guard function to check if Json array contains PreparedEmail objects
const isPreparedEmailArray = (arr: any[]): arr is PreparedEmail[] => {
  return arr.length > 0 && 
         typeof arr[0] === 'object' && 
         arr[0] !== null &&
         'to' in arr[0] && 
         'from_name' in arr[0] && 
         'subject' in arr[0];
};

// Safe conversion function for Json to PreparedEmail array
const convertToPreparedEmails = (jsonData: any): PreparedEmail[] => {
  if (!Array.isArray(jsonData)) {
    console.warn('Expected array but got:', typeof jsonData);
    return [];
  }
  
  if (!isPreparedEmailArray(jsonData)) {
    console.warn('Array does not contain PreparedEmail objects');
    return [];
  }
  
  return jsonData;
};

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

  // FIXED: Perfect distribution algorithm for functions AND accounts
  const calculateCampaignSlicing = (preparedEmails: PreparedEmail[], config: any) => {
    const { functions: enabledFunctions } = getAvailableResources();
    
    if (enabledFunctions.length === 0) {
      throw new Error('No enabled Cloud Functions available');
    }

    const totalEmails = preparedEmails.length;
    
    // Use custom function count from config if specified
    const functionsToUse = config.useCustomConfig && config.customFunctionCount 
      ? Math.min(config.customFunctionCount, enabledFunctions.length)
      : enabledFunctions.length;
    
    console.log(`📊 PERFECT DISTRIBUTION: Using ${functionsToUse} functions for ${totalEmails} emails`);
    
    // Ensure minimum 1 email per function, otherwise reduce function count
    const actualFunctionsToUse = Math.min(functionsToUse, totalEmails);
    
    // FIXED: Perfect distribution - calculate exact emails per function
    const baseEmailsPerFunction = Math.floor(totalEmails / actualFunctionsToUse);
    const remainderEmails = totalEmails % actualFunctionsToUse;
    
    console.log(`📈 PERFECT SPLIT: ${totalEmails} emails → ${baseEmailsPerFunction} base + ${remainderEmails} remainder across ${actualFunctionsToUse} functions`);
    
    // Create slices with perfect distribution
    const functionsToUseList = enabledFunctions.slice(0, actualFunctionsToUse);
    let currentIndex = 0;
    
    const slices = functionsToUseList.map((func, functionIndex) => {
      // First `remainderEmails` functions get 1 extra email
      const emailsForThisFunction = baseEmailsPerFunction + (functionIndex < remainderEmails ? 1 : 0);
      
      const slice = {
        functionId: func.id,
        functionUrl: func.url,
        functionName: func.name,
        skip: currentIndex,
        limit: emailsForThisFunction,
        recipients: preparedEmails.slice(currentIndex, currentIndex + emailsForThisFunction)
      };
      
      currentIndex += emailsForThisFunction;
      return slice;
    }).filter(slice => slice.limit > 0);

    console.log(`🎯 PERFECT DISTRIBUTION COMPLETE:`, 
      slices.map(s => `${s.functionName}(${s.limit} emails)`));

    // Verify perfect distribution
    const totalDistributed = slices.reduce((sum, slice) => sum + slice.limit, 0);
    if (totalDistributed !== totalEmails) {
      console.error(`❌ DISTRIBUTION ERROR: ${totalDistributed} ≠ ${totalEmails}`);
    } else {
      console.log(`✅ PERFECT: ${totalDistributed} emails distributed perfectly`);
    }

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

      // FIXED: Better validation of prepared emails
      if (!campaign.prepared_emails || !Array.isArray(campaign.prepared_emails) || campaign.prepared_emails.length === 0) {
        throw new Error('Campaign has no prepared emails. Please prepare the campaign again.');
      }

      // Safe type conversion for prepared_emails
      const preparedEmails = convertToPreparedEmails(campaign.prepared_emails);
      
      console.log('📧 Valid prepared emails count:', preparedEmails.length);

      if (preparedEmails.length === 0) {
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

      // FIXED: Perfect distribution using improved algorithm
      const slices = calculateCampaignSlicing(preparedEmails, campaignData.config);
      console.log(`📈 Campaign perfectly distributed across ${slices.length} functions`);

      // Use custom account count if specified
      const accountsToUse = campaignData.config.useCustomConfig && campaignData.config.customAccountCount
        ? Math.min(campaignData.config.customAccountCount, selectedAccounts.length)
        : selectedAccounts.length;
      
      const accountsForSending = selectedAccounts.slice(0, accountsToUse);
      
      console.log(`📧 Using ${accountsForSending.length} accounts:`, accountsForSending.map(a => a.name));

      // FIXED: Configure accounts for ZERO DELAY and PERFECT ROTATION
      const gcfAccounts = accountsForSending.map(account => {
        const cleanConfig = { ...account.config };
        
        if (campaignData.config.sendingMode === 'zero-delay') {
          // ZERO DELAY = REMOVE ALL LIMITATIONS
          delete cleanConfig.emails_per_hour;
          delete cleanConfig.emails_per_second;
          delete cleanConfig.delay_in_seconds;
          delete cleanConfig.rate_limit_enabled;
          delete cleanConfig.rateLimit;
          cleanConfig.zero_delay_mode = true;
          cleanConfig.bypass_all_limits = true;
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

      // FIXED: Dispatch to ALL functions with perfect data distribution AND account rotation
      const dispatchPromises = slices.map(async (slice, index) => {
        // CRITICAL FIX: Ensure each slice gets the EXACT prepared emails with rotation
        const payload = {
          campaignId: campaign.id,
          slice: {
            skip: slice.skip,
            limit: slice.limit,
            recipients: slice.recipients.map(email => email.to), // Extract recipients
            preparedEmails: slice.recipients // Send full prepared data with rotation
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
              bypassRateLimits: campaignData.config.sendingMode === 'zero-delay',
              forceMaxSpeed: campaignData.config.sendingMode === 'zero-delay',
              perfectRotation: true // Enable perfect rotation
            }
          },
          accounts: gcfAccounts, // ALL accounts sent to ALL functions for perfect rotation
          organizationId
        };

        console.log(`🎯 DISPATCHING to ${slice.functionName}: ${slice.limit} emails with ${campaignData.config.sendingMode} mode and ${gcfAccounts.length} accounts`);

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
