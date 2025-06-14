
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

      console.log('🚀 SMTP ULTRA-FAST: Starting campaign dispatch');

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

      console.log('📧 SMTP: Found campaign:', existingCampaign.id);

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
          console.warn('⚠️ SMTP: Skipping invalid email data:', emailData);
          continue;
        }
        
        const email = emailData as any;
        if (!email.to || !email.from_name || !email.subject) {
          console.warn('⚠️ SMTP: Skipping email missing required fields:', email);
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

      console.log(`📧 SMTP: Processing ${preparedEmails.length} prepared emails`);

      // Get SMTP accounts ONLY - prioritize SMTP for ultra-fast sending
      const selectedAccountIds = campaignData.config?.selectedAccounts || [];
      const smtpAccounts = accounts.filter(account => 
        selectedAccountIds.includes(account.id) && 
        account.is_active && 
        account.type === 'smtp'
      );

      if (smtpAccounts.length === 0) {
        throw new Error('No active SMTP accounts selected. SMTP is required for ultra-fast sending.');
      }

      console.log(`🏪 SMTP ULTRA-FAST: Using ${smtpAccounts.length} SMTP accounts`);
      setProgress(25);

      // Get enabled functions
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found');
      }

      console.log(`🔧 SMTP: Using ${enabledFunctions.length} enabled functions`);
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

      // Distribute emails across functions for parallel processing
      const emailsPerFunction = Math.ceil(preparedEmails.length / enabledFunctions.length);
      
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        const startIndex = funcIndex * emailsPerFunction;
        const endIndex = Math.min(startIndex + emailsPerFunction, preparedEmails.length);
        const functionEmails = preparedEmails.slice(startIndex, endIndex);
        
        if (functionEmails.length === 0) {
          return { success: true, function: func.name, sentCount: 0 };
        }

        console.log(`🚀 SMTP: Function ${func.name} processing ${functionEmails.length} emails`);
        
        // Create optimized payload for SMTP ultra-fast sending
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
          accounts: smtpAccounts.map(account => ({
            id: account.id,
            name: account.name,
            email: account.email,
            type: 'smtp', // Force SMTP only
            config: {
              ...account.config,
              // Ultra-fast SMTP settings
              pool: true,
              maxConnections: 50,
              maxMessages: 100,
              rateDelta: 1000,
              rateLimit: 50
            }
          })),
          organizationId: organizationId,
          globalStartIndex: startIndex,
          ultraFastMode: true // Enable ultra-fast processing
        };

        console.log(`📦 SMTP ULTRA-FAST: Payload for ${func.name}:`, {
          preparedEmailsCount: functionEmails.length,
          smtpAccountsCount: smtpAccounts.length,
          ultraFastMode: true
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
          console.log(`✅ SMTP: Function ${func.name} result:`, result);
          
          return { 
            success: true, 
            function: func.name, 
            result,
            sentCount: result.sent || 0
          };

        } catch (error: any) {
          console.error(`❌ SMTP: Function ${func.name} failed:`, error);
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

      console.log(`🎉 SMTP ULTRA-FAST: FINAL RESULTS - ${totalSentEmails} emails sent`);

      if (totalSentEmails === 0) {
        const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
        throw new Error(`No emails were sent via SMTP. Errors: ${errors}`);
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

      toast.success(`SMTP Ultra-Fast: Campaign sent successfully! ${totalSentEmails} emails dispatched at maximum speed.`);

      return {
        success: true,
        message: `SMTP Ultra-Fast: ${totalSentEmails} emails sent`,
        totalEmails: totalSentEmails
      };

    } catch (error: any) {
      console.error('❌ SMTP ULTRA-FAST: Campaign failed:', error);
      toast.error(`SMTP Campaign failed: ${error.message}`);
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
