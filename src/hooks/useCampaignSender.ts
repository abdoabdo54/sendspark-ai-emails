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

  // Enhanced fetch with retry logic
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        console.log(`✅ Success on attempt ${attempt} for ${url}`);
        return response;
        
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed for ${url}:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    if (!organizationId) {
      throw new Error('Organization not selected');
    }

    try {
      setIsSending(true);
      setProgress(0);

      console.log('🚀 ULTRA-FAST SEND: Starting enhanced campaign dispatch with retry logic');

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

      // Better distribution logic
      const emailsPerFunction = Math.ceil(preparedEmails.length / enabledFunctions.length);
      
      // Create enhanced payloads with better error handling
      const functionPayloads = enabledFunctions.map((func, funcIndex) => {
        const startIndex = funcIndex * emailsPerFunction;
        const endIndex = Math.min(startIndex + emailsPerFunction, preparedEmails.length);
        const functionEmails = preparedEmails.slice(startIndex, endIndex);
        
        if (functionEmails.length === 0) {
          return null;
        }

        console.log(`🔥 FUNCTION ${funcIndex + 1}: Assigning ${functionEmails.length} emails (${startIndex} to ${endIndex - 1})`);

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
                // ENHANCED SPEED SETTINGS
                ...(account.type === 'smtp' ? {
                  pool: true,
                  maxConnections: 500, // Increased connections
                  maxMessages: Infinity,
                  rateDelta: 0,
                  rateLimit: false,
                  connectionTimeout: 60000, // Reduced timeout
                  greetingTimeout: 30000,
                  socketTimeout: 60000,
                  sendTimeout: 0,
                  idleTimeout: 0,
                  keepAlive: true,
                  concurrentConnections: 100 // More concurrent connections
                } : {
                  exec_url: account.config?.exec_url || account.config?.script_url,
                  script_url: account.config?.script_url,
                  api_key: account.config?.api_key,
                  timeout: 45000, // Longer timeout for Apps Script
                  parallelMode: true,
                  maxConcurrent: 50
                })
              }
            })),
            organizationId: organizationId,
            globalStartIndex: startIndex,
            ultraFastMode: true,
            maxParallel: true,
            forceParallelExecution: true,
            functionIndex: funcIndex,
            totalFunctions: enabledFunctions.length
          }
        };
      }).filter(Boolean);

      setProgress(75);

      console.log(`🚀 ULTRA-FAST: Launching ${functionPayloads.length} functions with enhanced retry logic`);

      // ENHANCED: Fire all functions with robust error handling and retries
      const functionPromises = functionPayloads.map(async ({ func, payload }, index) => {
        const startTime = Date.now();
        const functionLabel = `F${index + 1}(${func.name})`;
        
        try {
          console.log(`🚀 ${functionLabel}: Firing with ${payload.slice.preparedEmails.length} emails`);
          
          const response = await fetchWithRetry(func.url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Keep-Alive': 'timeout=300, max=1000',
              'Cache-Control': 'no-cache',
              'X-Parallel-Mode': 'true',
              'X-Function-Index': index.toString(),
              'X-Total-Functions': enabledFunctions.length.toString(),
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          const duration = Date.now() - startTime;
          
          console.log(`✅ ${functionLabel}: Completed in ${duration}ms, sent ${result.sent || 0} emails`);
          
          return { 
            success: true, 
            function: func.name, 
            result,
            sentCount: result.sent || 0,
            duration,
            functionIndex: index
          };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`❌ ${functionLabel}: Failed after ${duration}ms:`, error);
          return { 
            success: false, 
            function: func.name, 
            error: error.message,
            sentCount: 0,
            duration,
            functionIndex: index
          };
        }
      });

      // Wait for all functions with enhanced error reporting
      const [statusResult, ...results] = await Promise.all([statusUpdatePromise, ...functionPromises]);
      
      if (statusResult.error) {
        console.warn('Status update failed:', statusResult.error);
      }
      
      setProgress(100);

      const successfulDispatches = results.filter(r => r.success);
      const failedDispatches = results.filter(r => !r.success);
      const totalSentEmails = successfulDispatches.reduce((sum, result) => sum + (result.sentCount || 0), 0);
      const totalDuration = Math.max(...results.map(r => r.duration || 0));

      console.log(`🎉 ENHANCED DISPATCH COMPLETE: ${totalSentEmails}/${preparedEmails.length} emails sent in ${totalDuration}ms`);
      console.log(`📊 SUCCESS BREAKDOWN: ${successfulDispatches.map(r => `F${r.functionIndex + 1}:${r.sentCount}`).join(', ')}`);
      
      if (failedDispatches.length > 0) {
        console.error(`❌ FAILED FUNCTIONS: ${failedDispatches.map(r => `F${r.functionIndex + 1}:${r.error}`).join(', ')}`);
      }

      // Enhanced error handling
      if (totalSentEmails === 0) {
        const errors = failedDispatches.map(r => r.error).join(', ');
        throw new Error(`No emails were sent. Network errors: ${errors}`);
      }

      // Update final campaign status
      const finalUpdate = await supabase
        .from('email_campaigns')
        .update({ 
          status: totalSentEmails > 0 ? 'sent' : 'failed',
          sent_count: totalSentEmails,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCampaign.id);

      if (finalUpdate.error) {
        console.warn('Final status update failed:', finalUpdate.error);
      }

      const successMessage = `Enhanced Campaign Complete! ${totalSentEmails}/${preparedEmails.length} emails sent in ${totalDuration}ms`;
      const speed = Math.round(totalSentEmails / (totalDuration / 1000));
      
      toast.success(successMessage);

      return {
        success: true,
        message: successMessage,
        totalEmails: totalSentEmails,
        targetEmails: preparedEmails.length,
        duration: totalDuration,
        speed: speed,
        functionsUsed: successfulDispatches.length,
        functionsFailed: failedDispatches.length
      };

    } catch (error: any) {
      console.error('❌ ENHANCED DISPATCH: Campaign failed:', error);
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
