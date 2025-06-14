
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmailAccounts } from './useEmailAccounts';
import { useGcfFunctions } from './useGcfFunctions';
import { toast } from 'sonner';

interface PreparedEmailJson {
  to: string;
  from_name: string;
  subject: string;
  prepared_at: string;
  rotation_index: number;
}

interface PreparedEmail {
  to: string;
  from_name: string;
  subject: string;
  prepared_at: string;
  rotation_index: number;
}

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

  const sendCampaign = async (campaignData: CampaignData) => {
    if (!organizationId) {
      throw new Error('Organization not selected');
    }

    try {
      setIsSending(true);
      setProgress(0);

      console.log('🚀 SEND: Starting campaign dispatch with proper data validation');
      console.log('🚀 SEND: Campaign config:', campaignData.config);

      // Get the campaign from database to access prepared emails
      const { data: existingCampaign, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('subject', campaignData.subject)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error('❌ SEND: Error fetching campaign:', fetchError);
        throw new Error('Campaign not found');
      }

      console.log('📧 SEND: Found campaign:', {
        id: existingCampaign.id,
        status: existingCampaign.status,
        preparedEmailsExists: !!existingCampaign.prepared_emails,
        totalRecipients: existingCampaign.total_recipients
      });

      // Check if campaign is prepared
      if (existingCampaign.status !== 'prepared') {
        throw new Error(`Campaign status is '${existingCampaign.status}'. Only prepared campaigns can be sent.`);
      }

      // Get prepared emails and properly validate/cast them
      const preparedEmailsJson = existingCampaign.prepared_emails;
      if (!preparedEmailsJson) {
        throw new Error('No prepared emails found. Please prepare the campaign first.');
      }

      // CRITICAL FIX: Properly validate and cast the prepared emails
      let preparedEmails: PreparedEmail[];
      
      try {
        // Cast from Json to proper type with validation
        const rawData = preparedEmailsJson as unknown as PreparedEmailJson[];
        
        if (!Array.isArray(rawData)) {
          throw new Error('Prepared emails is not an array');
        }

        // Validate each email object has required fields
        preparedEmails = rawData.filter((email): email is PreparedEmail => {
          return email && 
                 typeof email === 'object' && 
                 typeof email.to === 'string' && 
                 typeof email.subject === 'string' && 
                 typeof email.from_name === 'string' &&
                 email.to.includes('@');
        });

        if (preparedEmails.length === 0) {
          throw new Error('No valid prepared emails found after validation');
        }

        console.log(`✅ SEND: Validated ${preparedEmails.length}/${rawData.length} prepared emails`);
        
      } catch (validationError) {
        console.error('❌ SEND: Prepared emails validation failed:', validationError);
        throw new Error(`Invalid prepared emails format: ${validationError.message}`);
      }

      console.log(`📧 SEND: Using ${preparedEmails.length} validated prepared emails`);
      console.log(`📧 SEND: Sample prepared email:`, {
        to: preparedEmails[0].to,
        subject: preparedEmails[0].subject,
        from_name: preparedEmails[0].from_name,
        rotation_index: preparedEmails[0].rotation_index
      });

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

      console.log(`🏪 SEND: Using ${selectedAccounts.length} accounts`);
      selectedAccounts.forEach((account, index) => {
        console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      });

      setProgress(25);

      // Get enabled functions for dispatch
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found. Please add and enable at least one function in Function Manager.');
      }

      console.log(`🔧 SEND: Using ${enabledFunctions.length} enabled functions`);

      setProgress(50);

      // Update campaign to sending status
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_count: 0,
          sent_at: null,
          error_message: null 
        })
        .eq('id', existingCampaign.id);

      if (updateError) {
        console.error('❌ SEND: Failed to update campaign status:', updateError);
      }

      setProgress(75);

      // Calculate emails per function
      const emailsPerFunction = Math.ceil(preparedEmails.length / enabledFunctions.length);
      
      console.log(`📊 SEND: Distribution - ${emailsPerFunction} emails per function`);

      // Dispatch to functions with VALIDATED prepared emails
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        const startIndex = funcIndex * emailsPerFunction;
        const endIndex = Math.min(startIndex + emailsPerFunction, preparedEmails.length);
        const slicePreparedEmails = preparedEmails.slice(startIndex, endIndex);
        
        if (slicePreparedEmails.length === 0) {
          console.log(`⏭️ SEND: Function ${func.name} has no emails to process`);
          return { success: true, function: func.name, result: { message: 'No emails assigned' }, url: func.url, sentCount: 0 };
        }

        console.log(`🚀 SEND: Dispatching to ${func.name} with ${slicePreparedEmails.length} VALIDATED prepared emails`);
        
        // CRITICAL: Send properly structured payload with validated data
        const dispatchPayload = {
          campaignId: existingCampaign.id,
          slice: {
            preparedEmails: slicePreparedEmails // Send validated prepared email objects
          },
          campaignData: {
            from_name: campaignData.from_name,
            subject: campaignData.subject,
            html_content: campaignData.html_content || '',
            text_content: campaignData.text_content || '',
            config: {
              ...campaignData.config,
              sendingMode: campaignData.config?.sendingMode || 'zero-delay'
            }
          },
          accounts: selectedAccounts.map(account => ({
            id: account.id,
            name: account.name,
            email: account.email,
            type: account.type,
            config: account.config
          })),
          organizationId: organizationId,
          globalStartIndex: startIndex
        };

        console.log(`📦 SEND: Function ${func.name} payload validation:`, {
          campaignId: existingCampaign.id,
          preparedEmailsCount: slicePreparedEmails.length,
          accountCount: selectedAccounts.length,
          globalStartIndex: startIndex,
          firstEmail: {
            to: slicePreparedEmails[0]?.to,
            subject: slicePreparedEmails[0]?.subject,
            from_name: slicePreparedEmails[0]?.from_name
          }
        });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
          
          const response = await fetch(func.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispatchPayload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log(`📡 SEND: Function ${func.name} response status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ SEND: Function ${func.name} HTTP error:`, response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
          }

          const result = await response.json();
          console.log(`✅ SEND: Function ${func.name} completed:`, {
            sent: result.sent,
            processed: result.processed,
            successRate: result.successRate
          });
          
          return { 
            success: true, 
            function: func.name, 
            result, 
            url: func.url,
            sentCount: result.sent || 0
          };

        } catch (error: any) {
          console.error(`❌ SEND: Function ${func.name} failed:`, error);
          
          let errorMessage = error.message;
          if (error.name === 'AbortError') {
            errorMessage = 'Request timeout (5 minutes)';
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error - check function URL';
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
      const totalSentEmails = successfulDispatches.reduce((sum, result) => sum + (result.sentCount || 0), 0);

      console.log(`🎉 SEND: FINAL RESULTS - ${successfulDispatches.length} successful, ${failedDispatches.length} failed`);
      console.log(`📊 SEND: Total emails sent: ${totalSentEmails}/${preparedEmails.length}`);

      // Update campaign final status
      if (successfulDispatches.length > 0) {
        const finalStatus = totalSentEmails === preparedEmails.length ? 'sent' : 'partial_success';
        await supabase
          .from('email_campaigns')
          .update({ 
            status: finalStatus,
            sent_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            sent_count: totalSentEmails
          })
          .eq('id', existingCampaign.id);

        console.log(`📝 SEND: Campaign status updated to ${finalStatus} with ${totalSentEmails} emails sent`);
      }

      if (successfulDispatches.length === 0) {
        const errorDetails = failedDispatches.map(f => `${f.function}: ${f.error}`).join('; ');
        
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'failed',
            error_message: errorDetails,
            completed_at: new Date().toISOString()
          })
          .eq('id', existingCampaign.id);
          
        throw new Error(`All function dispatches failed: ${errorDetails}`);
      }

      // Show results with actual numbers
      if (failedDispatches.length > 0) {
        toast.warning(`Campaign sent with issues: ${failedDispatches.length} functions failed. ${totalSentEmails} emails sent.`);
      } else {
        toast.success(`Campaign sent successfully! ${totalSentEmails} emails dispatched.`);
      }

      return {
        success: true,
        message: `Campaign dispatched: ${totalSentEmails} emails sent via ${successfulDispatches.length} functions`,
        totalEmails: totalSentEmails,
        accountsUsed: selectedAccounts.length,
        functionsUsed: successfulDispatches.length,
        campaignId: existingCampaign.id
      };

    } catch (error: any) {
      console.error('❌ SEND: Campaign dispatch failed:', error);
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
