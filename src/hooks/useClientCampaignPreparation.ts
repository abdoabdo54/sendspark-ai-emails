
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PreparedEmail {
  to: string;
  from_name: string;
  subject: string;
  prepared_at: string;
  rotation_index: number;
}

export const useClientCampaignPreparation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  const parseRecipients = (recipientsText: string): string[] => {
    console.log('📝 Parsing recipients from text:', recipientsText.length, 'characters');
    
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

    console.log(`📊 Found ${recipients.length} valid recipients`);
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
      console.log('🔧 CLIENT-SIDE PREPARATION: Starting for campaign:', campaignId);

      // Get the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error('Campaign not found');
      }

      // Allow preparation for any status except 'sending'
      if (campaign.status === 'sending') {
        throw new Error('Cannot prepare campaign while it is being sent');
      }

      console.log('📧 Processing campaign:', {
        id: campaignId,
        subject: campaign.subject,
        status: campaign.status,
        recipientsLength: campaign.recipients?.length || 0
      });

      // Parse recipients
      const recipients = parseRecipients(campaign.recipients || '');
      
      if (recipients.length === 0) {
        throw new Error('No valid recipients found');
      }

      // Parse rotation configuration
      const config = campaign.config || {};
      
      // Parse from names - each line is a separate from name
      let fromNames = [campaign.from_name]; // Default fallback
      if (config.rotation?.useFromNameRotation && config.rotation.fromNames) {
        const parsed = parseRotationData(config.rotation.fromNames);
        if (parsed.length > 0) {
          fromNames = parsed;
        }
      }
      
      // Parse subjects - each line is a separate subject
      let subjects = [campaign.subject]; // Default fallback
      if (config.rotation?.useSubjectRotation && config.rotation.subjects) {
        const parsed = parseRotationData(config.rotation.subjects);
        if (parsed.length > 0) {
          subjects = parsed;
        }
      }

      console.log('🔄 CLIENT ROTATION:', {
        fromNamesCount: fromNames.length,
        subjectsCount: subjects.length,
        fromNames: fromNames.slice(0, 3),
        subjects: subjects.slice(0, 3)
      });

      // Process in batches to avoid blocking UI and show progress
      const BATCH_SIZE = 1000; // Process 1000 emails at a time
      const totalEmails = recipients.length;
      const batches = Math.ceil(totalEmails / BATCH_SIZE);
      setTotalBatches(batches);

      let allPreparedEmails: PreparedEmail[] = [];

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        setCurrentBatch(batchIndex + 1);
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalEmails);
        const batchRecipients = recipients.slice(startIdx, endIdx);

        console.log(`📦 Processing batch ${batchIndex + 1}/${batches}: ${batchRecipients.length} emails`);

        // Create prepared emails for this batch with perfect rotation
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

        // Allow UI to update between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ CLIENT PREPARATION COMPLETE: ${allPreparedEmails.length} emails processed`);
      console.log(`📧 Sample prepared emails:`, allPreparedEmails.slice(0, 3));

      // Update campaign with prepared emails - this is the only database operation
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
        console.error('❌ Failed to update campaign:', updateError);
        throw new Error(`Failed to save preparation data: ${updateError.message}`);
      }

      console.log(`🎉 CLIENT SUCCESS: Campaign prepared with ${totalEmails} emails`);

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
      console.error('❌ CLIENT PREPARATION ERROR:', error);
      
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
