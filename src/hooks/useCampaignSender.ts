
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

      console.log('🚀 OPTIMIZED CAMPAIGN DISPATCH: Starting with enhanced stability');
      console.log('Campaign config:', campaignData.config);

      const recipients = parseRecipients(campaignData.recipients);
      if (recipients.length === 0) {
        throw new Error('No valid recipients found');
      }

      // OPTIMIZATION: Check for large campaigns and recommend chunking
      if (recipients.length > 5000) {
        console.warn(`⚠️ Large campaign detected: ${recipients.length} recipients. Consider breaking into smaller campaigns for better reliability.`);
        toast.warning(`Large campaign detected (${recipients.length} recipients). For better reliability, consider breaking this into smaller campaigns of 2,000-3,000 recipients each.`, {
          duration: 8000
        });
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

      console.log(`🏪 OPTIMIZED ROTATION: Using ${selectedAccounts.length} accounts for ${recipients.length} recipients`);
      selectedAccounts.forEach((account, index) => {
        console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      });

      setProgress(25);

      // Get enabled functions for dispatch
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found. Please add and enable at least one function in Function Manager.');
      }

      console.log(`🔧 OPTIMIZED DISPATCH: Using ${enabledFunctions.length} enabled functions`);
      enabledFunctions.forEach((func, index) => {
        console.log(`   Function ${index + 1}: ${func.name} - ${func.url}`);
      });

      setProgress(50);

      // Create campaign record first
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          organization_id: organizationId,
          subject: campaignData.subject,
          from_name: campaignData.from_name,
          recipients: campaignData.recipients,
          html_content: campaignData.html_content || '',
          text_content: campaignData.text_content || '',
          send_method: campaignData.send_method,
          status: 'sending',
          config: campaignData.config,
          total_recipients: recipients.length,
          sent_count: 0
        })
        .select()
        .single();

      if (campaignError) {
        console.error('❌ Failed to create campaign:', campaignError);
        throw new Error('Failed to create campaign record');
      }

      const campaignId = campaign.id;
      console.log(`📝 Campaign created with ID: ${campaignId}`);

      setProgress(75);

      // OPTIMIZED: Calculate recipients per function with better distribution
      const recipientsPerFunction = Math.ceil(recipients.length / enabledFunctions.length);
      
      console.log(`📊 OPTIMIZED DISTRIBUTION: ~${recipientsPerFunction} recipients per function`);

      // ENHANCED: Parallel dispatch with better error handling and timeout
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        const startIndex = funcIndex * recipientsPerFunction;
        const endIndex = Math.min(startIndex + recipientsPerFunction, recipients.length);
        const sliceRecipients = recipients.slice(startIndex, endIndex);
        
        if (sliceRecipients.length === 0) {
          console.log(`⏭️ Function ${func.name} has no recipients to process`);
          return { success: true, function: func.name, result: { message: 'No recipients assigned' }, url: func.url };
        }

        console.log(`🚀 DISPATCHING to function ${funcIndex + 1}: ${func.name} with ${sliceRecipients.length} recipients (global index ${startIndex} to ${endIndex - 1})`);
        
        const dispatchPayload = {
          campaignId: campaignId,
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
              optimizedForStability: true
            }
          },
          accounts: selectedAccounts,
          organizationId: organizationId,
          globalStartIndex: startIndex
        };

        console.log(`📦 Function ${func.name} payload:`, {
          campaignId: dispatchPayload.campaignId,
          recipientCount: sliceRecipients.length,
          accountCount: selectedAccounts.length,
          globalStartIndex: startIndex,
          sendingMode: dispatchPayload.campaignData.config.sendingMode,
          optimizedForStability: dispatchPayload.campaignData.config.optimizedForStability
        });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000); // INCREASED: 3 minutes timeout
          
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
          
          return { 
            success: true, 
            function: func.name, 
            result, 
            url: func.url,
            sentCount: result.sent || 0
          };

        } catch (error: any) {
          console.error(`❌ Function ${func.name} failed:`, error);
          
          // Update campaign with partial failure
          try {
            await supabase
              .from('email_campaigns')
              .update({ 
                error_message: `Function ${func.name} failed: ${error.message}`,
                status: 'partial_failure'
              })
              .eq('id', campaignId);
          } catch (dbError) {
            console.error('❌ Failed to update campaign error status:', dbError);
          }
          
          let errorMessage = error.message;
          if (error.name === 'AbortError') {
            errorMessage = 'Request timeout (3 minutes) - consider breaking campaign into smaller chunks';
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

      console.log(`🎉 OPTIMIZED DISPATCH COMPLETE: ${successfulDispatches.length} successful, ${failedDispatches.length} failed`);
      console.log(`📊 TOTAL EMAILS SENT: ${totalSentEmails}/${recipients.length}`);

      // Update campaign status after successful dispatch
      if (successfulDispatches.length > 0) {
        try {
          const finalStatus = failedDispatches.length === 0 ? 'sent' : 'partial_success';
          const campaignUpdate = await supabase
            .from('email_campaigns')
            .update({ 
              status: finalStatus,
              sent_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              sent_count: totalSentEmails
            })
            .eq('id', campaignId);

          console.log(`📝 Campaign status updated to ${finalStatus}:`, campaignUpdate);
        } catch (updateError) {
          console.error('❌ Failed to update campaign status:', updateError);
        }
      }

      if (successfulDispatches.length === 0) {
        const errorDetails = failedDispatches.map(f => `${f.function}: ${f.error}`).join('; ');
        
        // Update campaign status to failed
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: errorDetails,
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
          
        throw new Error(`All ${enabledFunctions.length} function dispatches failed. Details: ${errorDetails}`);
      }

      // Show appropriate success/warning message
      if (failedDispatches.length > 0) {
        console.warn(`⚠️ ${failedDispatches.length} functions failed, but ${successfulDispatches.length} succeeded`);
        toast.warning(`Campaign dispatched with some issues: ${failedDispatches.length} functions failed, ${successfulDispatches.length} succeeded. ${totalSentEmails} emails sent successfully.`);
      } else {
        toast.success(`Campaign dispatched successfully! All ${successfulDispatches.length} functions completed processing ${totalSentEmails} emails with optimized stability.`);
      }

      return {
        success: true,
        message: `Campaign dispatched to ${successfulDispatches.length} functions with optimized stability`,
        totalEmails: totalSentEmails,
        accountsUsed: selectedAccounts.length,
        functionsUsed: successfulDispatches.length,
        optimizedForStability: true,
        campaignId: campaignId
      };

    } catch (error: any) {
      console.error('❌ OPTIMIZED CAMPAIGN DISPATCH FAILED:', error);
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
