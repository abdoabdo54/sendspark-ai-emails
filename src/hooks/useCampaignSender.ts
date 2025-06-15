
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

  // Enhanced fetch with comprehensive retry logic and better error reporting
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // Increased to 2 minutes
        
        const startTime = Date.now();
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          // Add explicit headers to help with CORS
          headers: {
            ...options.headers,
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
          let errorText;
          try {
            errorText = await response.text();
          } catch {
            errorText = `HTTP ${response.status}`;
          }
          console.error(`❌ HTTP Error ${response.status} for ${url} after ${duration}ms:`, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        console.log(`✅ Success on attempt ${attempt} for ${url} in ${duration}ms`);
        return response;
        
      } catch (error: any) {
        lastError = error;
        const errorType = error.name === 'AbortError' ? 'TIMEOUT' : 
                         error.name === 'TypeError' && error.message.includes('fetch') ? 'NETWORK/CORS' : 'NETWORK';
        console.error(`❌ Attempt ${attempt} failed for ${url} (${errorType}):`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };

  // Enhanced health check with detailed response handling
  const checkFunctionHealth = async (url: string) => {
    try {
      console.log(`🔍 Health checking: ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({ test: true, ping: "health-check" }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined // 15 second timeout
      });
      
      if (!response.ok) {
        console.error(`❌ Health check failed for ${url}: HTTP ${response.status}`);
        return false;
      }
      
      const result = await response.json();
      console.log(`✅ Health check passed for ${url}:`, result.message);
      return true;
    } catch (e: any) {
      console.warn(`❌ Health check error for ${url}:`, e.message);
      return false;
    }
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    if (!organizationId) {
      throw new Error('Organization not selected');
    }

    // Enhanced error tracking
    let failedFunctionUrls: string[] = [];
    let healthCheckResults: any[] = [];

    try {
      setIsSending(true);
      setProgress(0);

      // Enhanced health check with detailed logging
      console.log("🌐 Enhanced health check of GCF endpoints...");
      // Use already loaded functions from useGcfFunctions hook
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found. Please add and enable at least one function in Function Manager.');
      }

      console.log(`🔍 Health checking ${enabledFunctions.length} functions...`);
      const healthResults = await Promise.all(
        enabledFunctions.map(async f => {
          const startTime = Date.now();
          const ok = await checkFunctionHealth(f.url);
          const duration = Date.now() - startTime;
          return { url: f.url, name: f.name, ok, duration };
        })
      );
      
      healthCheckResults = healthResults;
      const unhealthy = healthResults.filter(r => !r.ok);
      
      if (unhealthy.length > 0) {
        console.error('❌ Unhealthy functions:', unhealthy);
        throw new Error(
          `${unhealthy.length}/${healthResults.length} Google Cloud Functions are unreachable:\n` +
          unhealthy.map(f => `• ${f.name}: ${f.url} (${f.duration}ms)`).join('\n') + '\n\n' +
          `Possible causes:\n` +
          `• Function not deployed or not public\n` +
          `• Wrong Function URL in database\n` +
          `• Function not allowing CORS or POST requests\n` +
          `• Function timeout or memory limit exceeded\n` +
          `• Network connectivity issues`
        );
      }
      
      console.log(`✅ All ${healthResults.length} GCF endpoints are healthy`);
      healthResults.forEach(r => console.log(`  • ${r.name}: ${r.duration}ms`));

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

      console.log(`🚀 ULTRA-FAST: Launching ${functionPayloads.length} functions with enhanced error handling`);

      // Enhanced function execution with comprehensive error handling
      const functionPromises = functionPayloads.map(async ({ func, payload }, index) => {
        const startTime = Date.now();
        const functionLabel = `F${index + 1}(${func.name})`;
        
        try {
          console.log(`🚀 ${functionLabel}: Firing with ${payload.slice.preparedEmails.length} emails`);
          
          const response = await fetchWithRetry(func.url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Parallel-Mode': 'true',
              'X-Function-Index': index.toString(),
              'X-Total-Functions': enabledFunctions.length.toString(),
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          const duration = Date.now() - startTime;
          
          console.log(`✅ ${functionLabel}: Completed in ${duration}ms`, {
            sent: result.sent || 0,
            failed: result.failed || 0,
            successRate: result.successRate || 0,
            version: result.version
          });
          
          return { 
            success: true, 
            function: func.name, 
            result,
            sentCount: result.sent || 0,
            duration,
            functionIndex: index,
            enhanced: true
          };

        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`❌ ${functionLabel}: Failed after ${duration}ms:`, {
            error: error.message,
            errorType: error.name,
            url: func.url
          });
          failedFunctionUrls.push(func.url);
          return { 
            success: false, 
            function: func.name, 
            error: error.message,
            errorType: error.name,
            sentCount: 0,
            duration,
            functionIndex: index,
            url: func.url
          };
        }
      });

      // Enhanced results processing
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
        console.error(`❌ FAILED FUNCTIONS: ${failedDispatches.map(r => `F${r.functionIndex + 1}:${r.error} (${r.errorType})`).join(', ')}`);
      }

      // Enhanced error handling with detailed diagnostics
      if (totalSentEmails === 0) {
        const errorDetails = failedDispatches.map(r => `${r.function}: ${r.error} (${r.errorType})`).join('\n');
        const diagnostics = `
DIAGNOSTIC INFORMATION:
Health Check Results: ${healthCheckResults.map(h => `${h.name}: ${h.ok ? 'OK' : 'FAILED'} (${h.duration}ms)`).join(', ')}
Failed URLs: ${failedFunctionUrls.join(', ')}
Function Count: ${enabledFunctions.length}
Account Count: ${activeAccounts.length}

ERROR DETAILS:
${errorDetails}

TROUBLESHOOTING STEPS:
1. Check Cloud Function logs in Google Cloud Console
2. Verify function URLs in Function Manager
3. Ensure functions allow unauthenticated requests
4. Check function memory/timeout settings (increase to 2GB RAM, 300s timeout)
5. Verify CORS configuration and network connectivity
        `;
        throw new Error(`No emails were sent. ${diagnostics}`);
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

      // Enhanced error message with diagnostics
      let message = error?.message || "Campaign failed";
      if (failedFunctionUrls.length > 0) {
        message += `\n\nFailed Endpoints: ${failedFunctionUrls.join(', ')}`;
      }
      if (healthCheckResults.length > 0) {
        const failedHealthChecks = healthCheckResults.filter(h => !h.ok);
        if (failedHealthChecks.length > 0) {
          message += `\n\nHealth Check Failures: ${failedHealthChecks.map(h => h.name).join(', ')}`;
        }
      }
      
      toast.error(message);
      throw new Error(message);
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
