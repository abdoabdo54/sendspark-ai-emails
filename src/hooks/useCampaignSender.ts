
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

      console.log('🚀 HYBRID ULTRA-FAST: Starting campaign dispatch with SMTP + Apps Script');

      // Get the campaign from database
      const { data: existingCampaign, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('subject', campaignData.subject)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !existingCampaign) {
        throw new Error('Campaign not found');
      }

      console.log('📧 HYBRID: Found campaign:', existingCampaign.id);

      if (existingCampaign.status !== 'prepared') {
        throw new Error(`Campaign must be prepared before sending. Current status: ${existingCampaign.status}`);
      }

      // Parse prepared emails with proper validation
      const preparedEmailsData = existingCampaign.prepared_emails;
      if (!preparedEmailsData || !Array.isArray(preparedEmailsData)) {
        throw new Error('No prepared emails found. Please prepare the campaign first.');
      }

      // Validate and convert prepared emails
      const preparedEmails: PreparedEmail[] = [];
      for (const emailData of preparedEmailsData) {
        if (!emailData || typeof emailData !== 'object') {
          console.warn('⚠️ HYBRID: Skipping invalid email data:', emailData);
          continue;
        }
        
        const email = emailData as any;
        if (!email.to || !email.from_name || !email.subject) {
          console.warn('⚠️ HYBRID: Skipping email missing required fields:', email);
          continue;
        }
        
        preparedEmails.push({
          to: String(email.to),
          from_name: String(email.from_name),
          subject: String(email.subject),
          prepared_at: String(email.prepared_at || new Date().toISOString()),
          rotation_index: Number(email.rotation_index || 0)
        });
      }

      if (preparedEmails.length === 0) {
        throw new Error('No valid prepared emails found after validation');
      }

      console.log(`📧 HYBRID: Processing ${preparedEmails.length} prepared emails`);

      // Get both SMTP and Apps Script accounts
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      const allSelectedAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && account.is_active
      );

      const smtpAccounts = allSelectedAccounts.filter(account => account.type === 'smtp');
      const appsScriptAccounts = allSelectedAccounts.filter(account => account.type === 'apps-script');

      if (allSelectedAccounts.length === 0) {
        throw new Error('No active accounts selected for sending.');
      }

      // Enhanced Apps Script account validation and configuration
      const validAppsScriptAccounts = appsScriptAccounts.filter(account => {
        const config = account.config || {};
        const hasUrl = config.exec_url || config.script_url;
        
        if (!hasUrl) {
          console.warn(`⚠️ Apps Script account ${account.name} missing execution URL`);
          return false;
        }
        
        console.log(`✅ Apps Script account ${account.name} validated:`, {
          exec_url: config.exec_url ? 'configured' : 'missing',
          script_url: config.script_url ? 'configured' : 'missing',
          api_key: config.api_key ? 'configured' : 'missing'
        });
        
        return true;
      });

      console.log(`🏪 HYBRID ULTRA-FAST: Using ${smtpAccounts.length} SMTP + ${validAppsScriptAccounts.length} valid Apps Script accounts`);
      console.log('SMTP Accounts:', smtpAccounts.map(a => ({ name: a.name, email: a.email })));
      console.log('Apps Script Accounts:', validAppsScriptAccounts.map(a => ({ 
        name: a.name, 
        email: a.email, 
        execUrl: a.config?.exec_url || a.config?.script_url,
        hasApiKey: !!a.config?.api_key 
      })));
      
      setProgress(25);

      // Get enabled functions
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found');
      }

      console.log(`🔧 HYBRID: Using ${enabledFunctions.length} enabled functions`);
      setProgress(50);

      // Update campaign status to sending
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_count: 0
        })
        .eq('id', existingCampaign.id);

      setProgress(75);

      // Combine valid accounts for distribution
      const finalAccounts = [...smtpAccounts, ...validAppsScriptAccounts];

      // Distribute emails across functions for parallel processing
      const emailsPerFunction = Math.ceil(preparedEmails.length / enabledFunctions.length);
      
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        const startIndex = funcIndex * emailsPerFunction;
        const endIndex = Math.min(startIndex + emailsPerFunction, preparedEmails.length);
        const functionEmails = preparedEmails.slice(startIndex, endIndex);
        
        if (functionEmails.length === 0) {
          return { success: true, function: func.name, sentCount: 0 };
        }

        console.log(`🚀 HYBRID: Function ${func.name} processing ${functionEmails.length} emails`);
        
        // Create optimized payload for hybrid sending (SMTP + Apps Script)
        const payload = {
          campaignId: existingCampaign.id,
          slice: {
            preparedEmails: functionEmails
          },
          campaignData: {
            from_name: campaignData.from_name,
            subject: campaignData.subject,
            html_content: campaignData.html_content || '',
            text_content: campaignData.text_content || ''
          },
          accounts: finalAccounts.map(account => ({
            id: account.id,
            name: account.name,
            email: account.email,
            type: account.type, // Both 'smtp' and 'apps-script'
            config: {
              ...account.config,
              // ULTRA-FAST SMTP settings - NO LIMITS
              ...(account.type === 'smtp' ? {
                pool: true,
                maxConnections: 200,
                maxMessages: Infinity,
                rateDelta: 0,
                rateLimit: false,
                connectionTimeout: 180000,
                greetingTimeout: 90000,
                socketTimeout: 180000,
                sendTimeout: 0,
                idleTimeout: 0
              } : {
                // Enhanced Apps Script settings with fallbacks
                exec_url: account.config?.exec_url || account.config?.script_url,
                script_url: account.config?.script_url,
                api_key: account.config?.api_key,
                script_id: account.config?.script_id,
                deployment_id: account.config?.deployment_id
              })
            }
          })),
          organizationId: organizationId,
          globalStartIndex: startIndex,
          hybridMode: true, // Enable hybrid SMTP + Apps Script processing
          accountDistribution: {
            smtp: smtpAccounts.length,
            appsScript: validAppsScriptAccounts.length,
            total: finalAccounts.length
          }
        };

        console.log(`📦 HYBRID ULTRA-FAST: Payload for ${func.name}:`, {
          preparedEmailsCount: functionEmails.length,
          smtpAccountsCount: smtpAccounts.length,
          appsScriptAccountsCount: validAppsScriptAccounts.length,
          totalAccountsCount: finalAccounts.length,
          hybridMode: true
        });

        try {
          const response = await fetch(func.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ HYBRID: Function ${func.name} result:`, result);
          
          // Log detailed Apps Script failures for debugging
          if (result.detailedFailures && result.detailedFailures.length > 0) {
            console.error(`❌ Apps Script detailed failures in ${func.name}:`, result.detailedFailures);
          }
          
          return { 
            success: true, 
            function: func.name, 
            result,
            sentCount: result.sent || 0,
            breakdown: result.breakdown || {},
            detailedFailures: result.detailedFailures || []
          };

        } catch (error: any) {
          console.error(`❌ HYBRID: Function ${func.name} failed:`, error);
          return { 
            success: false, 
            function: func.name, 
            error: error.message,
            sentCount: 0
          };
        }
      });

      const results = await Promise.all(functionPromises);
      setProgress(100);

      const successfulDispatches = results.filter(r => r.success);
      const totalSentEmails = successfulDispatches.reduce((sum, result) => sum + (result.sentCount || 0), 0);

      // Calculate breakdown totals
      const totalSmtpSent = successfulDispatches.reduce((sum, result) => sum + (result.breakdown?.smtp?.sent || 0), 0);
      const totalAppsScriptSent = successfulDispatches.reduce((sum, result) => sum + (result.breakdown?.appsScript?.sent || 0), 0);
      const totalSmtpFailed = successfulDispatches.reduce((sum, result) => sum + (result.breakdown?.smtp?.failed || 0), 0);
      const totalAppsScriptFailed = successfulDispatches.reduce((sum, result) => sum + (result.breakdown?.appsScript?.failed || 0), 0);

      // Collect detailed Apps Script failures
      const allAppsScriptFailures = successfulDispatches.flatMap(result => result.detailedFailures || []);

      console.log(`🎉 HYBRID ULTRA-FAST: FINAL RESULTS - ${totalSentEmails} emails sent (${totalSmtpSent} SMTP, ${totalAppsScriptSent} Apps Script)`);
      console.log(`🎉 HYBRID FAILURES: ${totalSmtpFailed} SMTP failed, ${totalAppsScriptFailed} Apps Script failed`);

      if (allAppsScriptFailures.length > 0) {
        console.error('❌ DETAILED Apps Script Failures:', allAppsScriptFailures);
      }

      if (totalSentEmails === 0) {
        const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
        throw new Error(`No emails were sent via hybrid method. Errors: ${errors}`);
      }

      // Update final campaign status
      const finalStatus = totalSentEmails > 0 ? 'sent' : 'failed';
      await supabase
        .from('email_campaigns')
        .update({ 
          status: finalStatus,
          sent_count: totalSentEmails,
          sent_at: totalSentEmails > 0 ? new Date().toISOString() : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingCampaign.id);

      // Show detailed success message with Apps Script failure details
      let successMessage = `Hybrid Ultra-Fast: Campaign sent successfully! ${totalSentEmails} emails dispatched (${totalSmtpSent} via SMTP, ${totalAppsScriptSent} via Apps Script)`;
      
      if (totalAppsScriptFailed > 0) {
        successMessage += `. ${totalAppsScriptFailed} Apps Script emails failed - check account configuration and execution URLs.`;
      }
      
      toast.success(successMessage);

      return {
        success: true,
        message: successMessage,
        totalEmails: totalSentEmails,
        breakdown: {
          smtp: { sent: totalSmtpSent, failed: totalSmtpFailed },
          appsScript: { sent: totalAppsScriptSent, failed: totalAppsScriptFailed }
        },
        appsScriptFailures: allAppsScriptFailures
      };

    } catch (error: any) {
      console.error('❌ HYBRID ULTRA-FAST: Campaign failed:', error);
      toast.error(`Hybrid Campaign failed: ${error.message}`);
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
