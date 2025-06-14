
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

interface EmailByAccount {
  [accountId: string]: {
    type: string;
    config: any;
    emails: Array<{
      recipient: string;
      subject: string;
      htmlContent: string;
      textContent: string;
      fromName: string;
      fromEmail: string;
    }>;
    accountInfo: {
      name: string;
      email: string;
    };
  };
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

  const distributeEmailsAcrossAccounts = (
    recipients: string[], 
    selectedAccounts: any[], 
    campaignData: CampaignData
  ): EmailByAccount => {
    console.log('🔄 PERFECT DISTRIBUTION: Starting email distribution across accounts');
    console.log(`📧 Total recipients: ${recipients.length}`);
    console.log(`🏪 Selected accounts: ${selectedAccounts.length}`);

    const emailsByAccount: EmailByAccount = {};

    // Initialize each account with empty email array
    selectedAccounts.forEach((account, accountIndex) => {
      emailsByAccount[account.id] = {
        type: account.type,
        config: account.config,
        emails: [],
        accountInfo: {
          name: account.name,
          email: account.email
        }
      };
      console.log(`🏪 Initialized account ${accountIndex + 1}: ${account.name} (${account.email})`);
    });

    // PERFECT ROUND-ROBIN DISTRIBUTION
    recipients.forEach((recipient, recipientIndex) => {
      const accountIndex = recipientIndex % selectedAccounts.length;
      const selectedAccount = selectedAccounts[accountIndex];
      
      console.log(`📤 Recipient ${recipientIndex + 1}: ${recipient} → Account ${accountIndex + 1} (${selectedAccount.name})`);

      emailsByAccount[selectedAccount.id].emails.push({
        recipient: recipient,
        subject: campaignData.subject,
        htmlContent: campaignData.html_content || '',
        textContent: campaignData.text_content || '',
        fromName: campaignData.from_name,
        fromEmail: selectedAccount.email
      });
    });

    // Log distribution summary
    console.log('📊 PERFECT DISTRIBUTION SUMMARY:');
    selectedAccounts.forEach((account, index) => {
      const emailCount = emailsByAccount[account.id].emails.length;
      console.log(`   Account ${index + 1} (${account.name}): ${emailCount} emails`);
    });

    const totalDistributed = Object.values(emailsByAccount).reduce((sum, acc) => sum + acc.emails.length, 0);
    console.log(`✅ PERFECT DISTRIBUTION COMPLETE: ${totalDistributed}/${recipients.length} emails distributed`);

    return emailsByAccount;
  };

  const sendCampaign = async (campaignData: CampaignData) => {
    if (!organizationId) {
      throw new Error('Organization not selected');
    }

    try {
      setIsSending(true);
      setProgress(0);

      console.log('🚀 CAMPAIGN DISPATCH: Starting with PERFECT account distribution');
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

      console.log(`🏪 PERFECT DISTRIBUTION: Using ${selectedAccounts.length} accounts for ${recipients.length} recipients`);
      selectedAccounts.forEach((account, index) => {
        console.log(`   Account ${index + 1}: ${account.name} (${account.email}) - ${account.type}`);
      });

      // Distribute emails across accounts with PERFECT rotation
      const emailsByAccount = distributeEmailsAcrossAccounts(recipients, selectedAccounts, campaignData);

      // Validate distribution
      const totalEmails = Object.values(emailsByAccount).reduce((sum, acc) => sum + acc.emails.length, 0);
      if (totalEmails !== recipients.length) {
        throw new Error(`Distribution mismatch: ${totalEmails} distributed vs ${recipients.length} recipients`);
      }

      setProgress(25);

      // Get enabled functions for dispatch
      const enabledFunctions = functions.filter(f => f.enabled);
      if (enabledFunctions.length === 0) {
        throw new Error('No enabled Google Cloud Functions found');
      }

      console.log(`🔧 DISPATCH: Using ${enabledFunctions.length} enabled functions`);
      enabledFunctions.forEach((func, index) => {
        console.log(`   Function ${index + 1}: ${func.name}`);
      });

      setProgress(50);

      // Prepare enhanced dispatch payload with perfect distribution
      const dispatchPayload = {
        campaignId: `dispatch-${Date.now()}`,
        emailsByAccount: emailsByAccount,
        supabaseUrl: supabase.supabaseUrl,
        supabaseKey: supabase.supabaseKey,
        config: {
          ...campaignData.config,
          sendingMode: campaignData.config?.sendingMode || 'zero-delay',
          dispatchMethod: 'parallel',
          perfectDistribution: true,
          accountRotation: true
        },
        rotation: campaignData.config?.rotation || {},
        testAfterConfig: campaignData.config?.testAfter || {},
        customRateLimit: campaignData.config?.customRateLimit || {}
      };

      console.log('📦 DISPATCH PAYLOAD SUMMARY:');
      console.log(`   Campaign ID: ${dispatchPayload.campaignId}`);
      console.log(`   Accounts with emails: ${Object.keys(emailsByAccount).length}`);
      console.log(`   Total emails: ${totalEmails}`);
      console.log(`   Sending mode: ${dispatchPayload.config.sendingMode}`);
      console.log(`   Perfect distribution: ${dispatchPayload.config.perfectDistribution}`);

      setProgress(75);

      // PARALLEL DISPATCH to all functions with PERFECT distribution
      const functionPromises = enabledFunctions.map(async (func, funcIndex) => {
        console.log(`🚀 DISPATCHING to function ${funcIndex + 1}: ${func.name}`);
        
        try {
          const response = await fetch(func.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispatchPayload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Function ${func.name} failed: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ Function ${func.name} completed:`, result);
          return { success: true, function: func.name, result };

        } catch (error) {
          console.error(`❌ Function ${func.name} failed:`, error);
          return { success: false, function: func.name, error: error.message };
        }
      });

      // Wait for all functions to complete
      const results = await Promise.all(functionPromises);
      
      setProgress(100);

      const successfulDispatches = results.filter(r => r.success).length;
      const failedDispatches = results.filter(r => !r.success).length;

      console.log(`🎉 DISPATCH COMPLETE: ${successfulDispatches} successful, ${failedDispatches} failed`);

      if (successfulDispatches === 0) {
        throw new Error('All function dispatches failed');
      }

      if (failedDispatches > 0) {
        console.warn(`⚠️ ${failedDispatches} functions failed, but ${successfulDispatches} succeeded`);
      }

      toast.success(`Campaign dispatched successfully! ${successfulDispatches} functions processing with perfect account distribution.`);

      return {
        success: true,
        message: `Campaign dispatched to ${successfulDispatches} functions with perfect account rotation`,
        totalEmails,
        accountsUsed: selectedAccounts.length,
        functionsUsed: successfulDispatches,
        perfectDistribution: true
      };

    } catch (error) {
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
