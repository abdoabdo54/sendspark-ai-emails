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
        .select('id, status')
        .eq('subject', campaignData.subject)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !existingCampaign) {
        throw new Error('Campaign not found');
      }

      if (existingCampaign.status !== 'prepared') {
        throw new Error(`Campaign must be prepared before sending. Current status: ${existingCampaign.status}`);
      }

      // ✔️  Pass only the campaignId (not entire prepared emails array) to each cloud function!
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      const allSelectedAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && account.is_active
      );
      const smtpAccounts = allSelectedAccounts.filter(account => account.type === 'smtp');
      const appsScriptAccounts = allSelectedAccounts.filter(account => account.type === 'apps-script');
      const validAppsScriptAccounts = appsScriptAccounts.filter(account => {
        const config = account.config || {};
        const hasUrl = config.exec_url || config.script_url;
        return !!hasUrl;
      });
      const finalAccounts = [...smtpAccounts, ...validAppsScriptAccounts];

      if (finalAccounts.length === 0) {
        throw new Error('No active accounts selected for sending.');
      }

      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found');
      }

      // Update campaign status to "sending"
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'sending',
          sent_count: 0
        })
        .eq('id', existingCampaign.id);

      // For max speed, only pass campaignId and split work among functions (the function fetches prepared emails by itself)
      setProgress(50);

      // Distribute emails across functions by simply passing starting indexes — the function fetches all data
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        return fetch(func.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: existingCampaign.id,
            functionIndex: funcIndex, // info for debugging/distribution
            totalFunctions: enabledFunctions.length,
            organizationId: organizationId,
            // Include account data to minimize function lookups (can be omitted if not needed)
            accounts: finalAccounts.map(account => ({
              id: account.id,
              name: account.name,
              email: account.email,
              type: account.type,
              config: account.config
            }))
          })
        }).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          return await response.json();
        });
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
