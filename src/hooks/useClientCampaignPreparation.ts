
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PreparedEmail {
  to: string;
  from_name: string;
  subject: string;
  prepared_at: string;
  rotation_index: number;
}

interface RotationConfig {
  useFromNameRotation?: boolean;
  fromNames?: string | string[];
  useSubjectRotation?: boolean;
  subjects?: string | string[];
}

interface CampaignConfig {
  rotation?: RotationConfig;
  selectedAccounts?: string[];
  sendingMode?: string;
  dispatchMethod?: string;
  [key: string]: any;
}

export const useClientCampaignPreparation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  const parseRecipients = (recipientsText: string): string[] => {
    console.log('📝 CLIENT PREP: Parsing recipients from text:', recipientsText?.length || 0, 'characters');
    
    if (!recipientsText?.trim()) {
      console.warn('⚠️ CLIENT PREP: No recipients text provided');
      return [];
    }

    let recipients: string[] = [];

    // Handle different recipient formats
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

    console.log(`📊 CLIENT PREP: Found ${recipients.length} valid recipients`);
    return recipients;
  };

  const parseRotationData = (rotationText: string | string[]): string[] => {
    if (!rotationText) return [];
    
    if (Array.isArray(rotationText)) {
      return rotationText.filter(item => item && item.trim());
    }
    
    if (typeof rotationText === 'string') {
      return rotationText
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    return [];
  };

  const prepareCampaignClientSide = async (campaignId: string) => {
    try {
      setIsProcessing(true);
      setProgress(0);
      console.log('🔧 CLIENT PREP: Starting preparation for campaign:', campaignId);

      // Get the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        console.error('❌ CLIENT PREP: Campaign not found:', campaignError);
        throw new Error('Campaign not found');
      }

      console.log('📧 CLIENT PREP: Processing campaign:', {
        id: campaignId,
        subject: campaign.subject,
        status: campaign.status,
        recipientsText: campaign.recipients?.substring(0, 100) + '...',
        recipientsLength: campaign.recipients?.length || 0
      });

      // Parse recipients
      const recipients = parseRecipients(campaign.recipients || '');
      
      if (recipients.length === 0) {
        console.error('❌ CLIENT PREP: No valid recipients found in:', campaign.recipients);
        throw new Error('No valid recipients found. Please check your recipient list format.');
      }

      console.log('✅ CLIENT PREP: Parsed recipients:', recipients.slice(0, 5), `(showing first 5 of ${recipients.length})`);

      // Parse rotation configuration
      const config = (campaign.config as CampaignConfig) || {};
      
      // Parse from names
      let fromNames = [campaign.from_name];
      if (config.rotation?.useFromNameRotation && config.rotation.fromNames) {
        const parsed = parseRotationData(config.rotation.fromNames);
        if (parsed.length > 0) {
          fromNames = parsed;
        }
      }
      
      // Parse subjects
      let subjects = [campaign.subject];
      if (config.rotation?.useSubjectRotation && config.rotation.subjects) {
        const parsed = parseRotationData(config.rotation.subjects);
        if (parsed.length > 0) {
          subjects = parsed;
        }
      }

      console.log('🔄 CLIENT PREP: Rotation config:', {
        fromNamesCount: fromNames.length,
        subjectsCount: subjects.length,
        sampleFromNames: fromNames.slice(0, 2),
        sampleSubjects: subjects.slice(0, 2)
      });

      // Process in batches
      const BATCH_SIZE = 1000;
      const totalEmails = recipients.length;
      const batches = Math.ceil(totalEmails / BATCH_SIZE);
      setTotalBatches(batches);

      let allPreparedEmails: PreparedEmail[] = [];

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        setCurrentBatch(batchIndex + 1);
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalEmails);
        const batchRecipients = recipients.slice(startIdx, endIdx);

        console.log(`📦 CLIENT PREP: Processing batch ${batchIndex + 1}/${batches}: ${batchRecipients.length} emails`);

        // Create prepared emails for this batch
        const batchPreparedEmails = batchRecipients.map((email, batchLocalIndex) => {
          const globalIndex = startIdx + batchLocalIndex;
          const fromNameIndex = globalIndex % fromNames.length;
          const subjectIndex = globalIndex % subjects.length;
          
          return {
            to: email,
            from_name: fromNames[fromNameIndex],
            subject: subjects[subjectIndex],
            prepared_at: new Date().toISOString(),
            rotation_index: globalIndex
          };
        });

        allPreparedEmails = [...allPreparedEmails, ...batchPreparedEmails];

        // Update progress
        const currentProgress = Math.round(((batchIndex + 1) / batches) * 100);
        setProgress(currentProgress);

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ CLIENT PREP: Complete - prepared ${allPreparedEmails.length} emails`);
      console.log(`📧 CLIENT PREP: Sample prepared emails:`, allPreparedEmails.slice(0, 3));

      // Update campaign with prepared emails
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          status: 'prepared',
          prepared_emails: allPreparedEmails,
          total_recipients: totalEmails,
          error_message: null
        })
        .eq('id', campaignId);

      if (updateError) {
        console.error('❌ CLIENT PREP: Failed to update campaign:', updateError);
        throw new Error(`Failed to save preparation data: ${updateError.message}`);
      }

      console.log(`🎉 CLIENT PREP: SUCCESS - Campaign prepared with ${totalEmails} emails`);

      return {
        success: true,
        message: `Campaign prepared successfully with ${totalEmails} emails`,
        emailCount: totalEmails,
        preparationComplete: true,
        rotationInfo: {
          fromNamesUsed: fromNames.length,
          subjectsUsed: subjects.length
        }
      };

    } catch (error: any) {
      console.error('❌ CLIENT PREP: Error:', error);
      
      // Update campaign status to failed
      await supabase
        .from('email_campaigns')
        .update({ 
          status: 'failed',
          error_message: `Client preparation failed: ${error.message}`
        })
        .eq('id', campaignId);
      
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return {
    prepareCampaignClientSide,
    isProcessing,
    progress,
    currentBatch,
    totalBatches
  };
};
