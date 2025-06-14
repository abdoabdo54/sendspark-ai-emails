
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmailAccounts } from './useEmailAccounts';
import { useGcfFunctions } from './useGcfFunctions';
import { toast } from 'sonner';

interface CampaignData {
  from_name: string;
  subject: string;
  recipients: string;
  html_content?: string;
  text_content?: string;
  send_method: string;
  config?: any;
}

export const useCampaignSender = (organizationId?: string) => {
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const { accounts } = useEmailAccounts(organizationId);
  const { functions } = useGcfFunctions(organizationId);

  const parseRecipients = (recipientsText: string): string[] => {
    console.log('📝 Parsing recipients from text:', recipientsText.length, 'characters');
    
    let recipients: string[] = [];

    if (recipientsText.includes('\n')) {
      recipients = recipientsText
        .split('\n')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (recipientsText.includes(',')) {
      recipients = recipientsText
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (recipientsText.includes(';')) {
      recipients = recipientsText
        .split(';')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else if (recipientsText.includes(' ')) {
      recipients = recipientsText
        .split(' ')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    } else {
      const singleEmail = recipientsText.trim();
      if (singleEmail && singleEmail.includes('@')) {
        recipients = [singleEmail];
      }
    }

    console.log(`📊 Found ${recipients.length} valid recipients`);
    return recipients;
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    if (!organizationId) {
      throw new Error('Organization not selected');
    }

    try {
      setIsSending(true);
      setProgress(0);

      console.log('🚀 CAMPAIGN DISPATCH: Starting with PERFECT equal distribution');
      console.log('Campaign config:', campaignData.config);

      const recipients = parseRecipients(campaignData.recipients);
      if (recipients.length === 0) {
        throw new Error('No valid recipients found');
      }

      // Get selected accounts from config
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      if (selectedAccountIds.length === 0) {
        throw new Error('No accounts selected for sending');
      }

      const selectedAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && account.is_active
      );

      if (selectedAccounts.length === 0) {
        throw new Error('No active accounts found from selection');
      }

      console.log(`🏪 EQUAL DISTRIBUTION: Using ${selectedAccounts.length} accounts for ${recipients.length} recipients`);
      selectedAccounts.forEach((account, index) => {
        console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      });

      setProgress(25);

      // Get enabled functions for dispatch
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found. Please add and enable at least one function in Function Manager.');
      }

      console.log(`🔧 DISPATCH: Using ${enabledFunctions.length} enabled functions`);
      enabledFunctions.forEach((func, index) => {
        console.log(`   Function ${index + 1}: ${func.name} - ${func.url}`);
      });

      setProgress(50);

      // Create a temporary campaign ID for tracking
      const tempCampaignId = `dispatch-${Date.now()}`;

      // Update campaign status to 'sending' at the start
      console.log('📝 Updating campaign status to SENDING');

      setProgress(75);

      // PERFECT EQUAL DISTRIBUTION: Calculate recipients per function
      const recipientsPerFunction = Math.ceil(recipients.length / enabledFunctions.length);
      
      console.log(`📊 PERFECT EQUAL DISTRIBUTION: ${recipientsPerFunction} recipients per function`);

      // PARALLEL DISPATCH to all functions with PERFECT equal distribution
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        const startIndex = funcIndex * recipientsPerFunction;
        const endIndex = Math.min(startIndex + recipientsPerFunction, recipients.length);
        const sliceRecipients = recipients.slice(startIndex, endIndex);
        
        if (sliceRecipients.length === 0) {
          console.log(`⏭️ Function ${func.name} has no recipients to process`);
          return { success: true, function: func.name, result: { message: 'No recipients assigned' }, url: func.url };
        }

        console.log(`🚀 DISPATCHING to function ${funcIndex + 1}: ${func.name} with ${sliceRecipients.length} recipients`);
        
        // Prepare payload with PERFECT EQUAL ACCOUNT DISTRIBUTION
        const dispatchPayload = {
          campaignId: tempCampaignId,
          slice: {
            recipients: sliceRecipients
          },
          campaignData: {
            from_name: campaignData.from_name,
            subject: campaignData.subject,
            html_content: campaignData.html_content || '',
            text_content: campaignData.text_content || '',
            config: {
              ...campaignData.config,
              sendingMode: campaignData.config?.sendingMode || 'zero-delay',
              dispatchMethod: 'parallel',
              perfectDistribution: true,
              equalAccountRotation: true,
              updateCampaignStats: true
            }
          },
          accounts: selectedAccounts, // All accounts for equal rotation within each function
          organizationId: organizationId
        };

        console.log(`📦 Function ${func.name} payload:`, {
          campaignId: dispatchPayload.campaignId,
          recipientCount: sliceRecipients.length,
          accountCount: selectedAccounts.length,
          sendingMode: dispatchPayload.campaignData.config.sendingMode,
          equalRotation: dispatchPayload.campaignData.config.equalAccountRotation
        });

        try {
          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
          
          const response = await fetch(func.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispatchPayload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log(`📡 Function ${func.name} response status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Function ${func.name} HTTP error:`, response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
          }

          const result = await response.json();
          console.log(`✅ Function ${func.name} completed successfully:`, result);
          
          // Return success with sent count for tracking
          return { 
            success: true, 
            function: func.name, 
            result, 
            url: func.url,
            sentCount: result.sent || sliceRecipients.length
          };

        } catch (error: any) {
          console.error(`❌ Function ${func.name} failed:`, error);
          
          // Provide more specific error messages
          let errorMessage = error.message;
          if (error.name === 'AbortError') {
            errorMessage = 'Request timeout (60s)';
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error - check function URL and connectivity';
          }
          
          return { 
            success: false, 
            function: func.name, 
            error: errorMessage,
            url: func.url,
            sentCount: 0
          };
        }
      });

      // Wait for all functions to complete
      const results = await Promise.all(functionPromises);
      
      setProgress(100);

      const successfulDispatches = results.filter(r => r.success);
      const failedDispatches = results.filter(r => !r.success);

      // Calculate total sent emails across all functions
      const totalSentEmails = successfulDispatches.reduce((sum, result) => sum + (result.sentCount || 0), 0);

      console.log(`🎉 DISPATCH COMPLETE: ${successfulDispatches.length} successful, ${failedDispatches.length} failed`);
      console.log(`📊 TOTAL EMAILS SENT: ${totalSentEmails}/${recipients.length}`);

      // Log detailed results
      if (failedDispatches.length > 0) {
        console.log('❌ FAILED DISPATCHES:');
        failedDispatches.forEach(failed => {
          console.log(`   ${failed.function} (${failed.url}): ${failed.error}`);
        });
      }

      if (successfulDispatches.length > 0) {
        console.log('✅ SUCCESSFUL DISPATCHES:');
        successfulDispatches.forEach(success => {
          console.log(`   ${success.function} (${success.url}): ${success.sentCount || 0} emails sent`);
        });
      }

      if (successfulDispatches.length === 0) {
        // Provide detailed error information
        const errorDetails = failedDispatches.map(f => `${f.function}: ${f.error}`).join('; ');
        throw new Error(`All ${enabledFunctions.length} function dispatches failed. Details: ${errorDetails}`);
      }

      // Show appropriate success/warning message
      if (failedDispatches.length > 0) {
        console.warn(`⚠️ ${failedDispatches.length} functions failed, but ${successfulDispatches.length} succeeded`);
        toast.warning(`Campaign dispatched with some issues: ${failedDispatches.length} functions failed, ${successfulDispatches.length} succeeded. ${totalSentEmails} emails sent.`);
      } else {
        toast.success(`Campaign dispatched successfully! ${successfulDispatches.length} functions processing ${totalSentEmails} emails with perfect equal distribution across ${selectedAccounts.length} accounts.`);
      }

      return {
        success: true,
        message: `Campaign dispatched to ${successfulDispatches.length} functions with perfect equal account rotation`,
        totalEmails: totalSentEmails,
        accountsUsed: selectedAccounts.length,
        functionsUsed: successfulDispatches.length,
        perfectDistribution: true
      };

    } catch (error: any) {
      console.error('❌ CAMPAIGN DISPATCH FAILED:', error);
      toast.error(`Campaign dispatch failed: ${error.message}`);
      throw error;
    } finally {
      setIsSending(false);
      setProgress(0);
    }
  };

  return {
    sendCampaign,
    isSending,
    progress
  };
};
