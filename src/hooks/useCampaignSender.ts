
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmailAccounts } from './useEmailAccounts';
import { useGcfFunctions } from './useGcfFunctions';
import { toast } from 'sonner';

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

      console.log('🚀 ULTRA-FAST SEND: Starting lightning-fast campaign dispatch');

      // Get the campaign from database - single query with minimal data transfer
      const { data: existingCampaign, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('id, status, prepared_emails, html_content, text_content, from_name, subject')
        .eq('subject', campaignData.subject)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !existingCampaign) {
        throw new Error('Campaign not found');
      }

      console.log('📧 ULTRA-FAST: Found campaign:', existingCampaign.id);

      if (existingCampaign.status !== 'prepared') {
        throw new Error(`Campaign must be prepared before sending. Current status: ${existingCampaign.status}`);
      }

      // Validate prepared emails - fast validation with proper type conversion
      const preparedEmailsData = existingCampaign.prepared_emails;
      if (!preparedEmailsData || !Array.isArray(preparedEmailsData) || preparedEmailsData.length === 0) {
        throw new Error('No prepared emails found. Please prepare the campaign first.');
      }

      // Safe type conversion from Json[] to PreparedEmail[]
      const preparedEmails: PreparedEmail[] = preparedEmailsData as unknown as PreparedEmail[];
      console.log(`📧 ULTRA-FAST: Processing ${preparedEmails.length} prepared emails`);

      // Get active accounts - optimized query
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      const activeAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && account.is_active
      );

      if (activeAccounts.length === 0) {
        throw new Error('No active accounts selected for sending.');
      }

      // Get enabled functions - fast filter
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found');
      }

      console.log(`🏪 ULTRA-FAST: Using ${activeAccounts.length} accounts across ${enabledFunctions.length} functions`);
      
      setProgress(25);

      // Update campaign status to sending - non-blocking
      const statusUpdatePromise = supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_count: 0,
          sent_at: new Date().toISOString()
        })
        .eq('id', existingCampaign.id);

      setProgress(50);

      // Distribute emails optimally across functions
      const emailsPerFunction = Math.ceil(preparedEmails.length / enabledFunctions.length);
      
      // Create ultra-optimized payloads for each function
      const functionPayloads = enabledFunctions.map((func, funcIndex) => {
        const startIndex = funcIndex * emailsPerFunction;
        const endIndex = Math.min(startIndex + emailsPerFunction, preparedEmails.length);
        const functionEmails = preparedEmails.slice(startIndex, endIndex);
        
        if (functionEmails.length === 0) {
          return null;
        }

        return {
          func,
          payload: {
            campaignId: existingCampaign.id,
            slice: {
              preparedEmails: functionEmails
            },
            campaignData: {
              from_name: campaignData.from_name,
              subject: campaignData.subject,
              html_content: existingCampaign.html_content || '',
              text_content: existingCampaign.text_content || ''
            },
            accounts: activeAccounts.map(account => ({
              id: account.id,
              name: account.name,
              email: account.email,
              type: account.type,
              config: {
                ...account.config,
                // MAXIMUM SPEED SETTINGS
                ...(account.type === 'smtp' ? {
                  pool: true,
                  maxConnections: 500, // Increased from 200
                  maxMessages: Infinity,
                  rateDelta: 0,
                  rateLimit: false,
                  connectionTimeout: 300000, // 5 minutes
                  greetingTimeout: 120000, // 2 minutes
                  socketTimeout: 300000, // 5 minutes
                  sendTimeout: 0,
                  idleTimeout: 0,
                  keepAlive: true
                } : {
                  exec_url: account.config?.exec_url || account.config?.script_url,
                  script_url: account.config?.script_url,
                  api_key: account.config?.api_key,
                  timeout: 60000 // 1 minute timeout for Apps Script
                })
              }
            })),
            organizationId: organizationId,
            globalStartIndex: startIndex,
            ultraFastMode: true,
            maxParallel: true
          }
        };
      }).filter(Boolean);

      setProgress(75);

      console.log(`🚀 ULTRA-FAST: Launching ${functionPayloads.length} functions in MAXIMUM PARALLEL mode`);

      // MAXIMUM SPEED: Fire all functions simultaneously with no delays
      const functionPromises = functionPayloads.map(async ({ func, payload }) => {
        const startTime = Date.now();
        
        try {
          console.log(`🚀 Firing function ${func.name} with ${payload.slice.preparedEmails.length} emails`);
          
          const response = await fetch(func.url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Keep-Alive': 'timeout=300, max=1000'
            },
            body: JSON.stringify(payload),
            // No timeout - let it run as fast as possible
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          const duration = Date.now() - startTime;
          
          console.log(`✅ ULTRA-FAST: Function ${func.name} completed in ${duration}ms:`, result);
          
          return { 
            success: true, 
            function: func.name, 
            result,
            sentCount: result.sent || 0,
            duration
          };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`❌ ULTRA-FAST: Function ${func.name} failed after ${duration}ms:`, error);
          return { 
            success: false, 
            function: func.name, 
            error: error.message,
            sentCount: 0,
            duration
          };
        }
      });

      // Wait for status update and all functions to complete
      const [, ...results] = await Promise.all([statusUpdatePromise, ...functionPromises]);
      
      setProgress(100);

      const successfulDispatches = results.filter(r => r.success);
      const totalSentEmails = successfulDispatches.reduce((sum, result) => sum + (result.sentCount || 0), 0);
      const totalDuration = Math.max(...results.map(r => r.duration || 0));

      console.log(`🎉 ULTRA-FAST COMPLETE: ${totalSentEmails} emails sent in ${totalDuration}ms`);

      if (totalSentEmails === 0) {
        const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
        throw new Error(`No emails were sent. Errors: ${errors}`);
      }

      // Update final campaign status - non-blocking
      supabase
        .from('email_campaigns')
        .update({ 
          status: totalSentEmails > 0 ? 'sent' : 'failed',
          sent_count: totalSentEmails,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCampaign.id);

      const successMessage = `Ultra-Fast Campaign Complete! ${totalSentEmails} emails sent in ${totalDuration}ms`;
      toast.success(successMessage);

      return {
        success: true,
        message: successMessage,
        totalEmails: totalSentEmails,
        duration: totalDuration,
        speed: Math.round(totalSentEmails / (totalDuration / 1000)) // emails per second
      };

    } catch (error: any) {
      console.error('❌ ULTRA-FAST: Campaign failed:', error);
      toast.error(`Campaign failed: ${error.message}`);
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
