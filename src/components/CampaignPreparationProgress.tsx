
import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CampaignPreparationProgressProps {
  campaignId: string;
  totalRecipients: number;
  onComplete: () => void;
  onCancel: () => void;
}

const CampaignPreparationProgress = ({ 
  campaignId, 
  totalRecipients, 
  onComplete, 
  onCancel 
}: CampaignPreparationProgressProps) => {
  const [preparedCount, setPreparedCount] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'completed' | 'failed'>('preparing');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [startTime] = useState(Date.now());
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(Math.ceil(totalRecipients / 1000));
  const [completionTimer, setCompletionTimer] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const checkProgress = async () => {
      try {
        console.log(`🔍 Checking progress for campaign: ${campaignId}`);
        
        // Get campaign status and prepared emails count
        const { data: campaign, error } = await supabase
          .from('email_campaigns')
          .select('status, prepared_emails, total_recipients')
          .eq('id', campaignId)
          .single();

        if (error) {
          console.error('Error checking campaign progress:', error);
          return;
        }

        if (campaign) {
          const preparedEmails = Array.isArray(campaign.prepared_emails) ? campaign.prepared_emails : [];
          const currentPreparedCount = preparedEmails.length;
          
          console.log(`📊 Progress: ${currentPreparedCount}/${totalRecipients} (${Math.round((currentPreparedCount / totalRecipients) * 100)}%)`);
          
          setPreparedCount(currentPreparedCount);
          setCurrentBatch(Math.ceil(currentPreparedCount / 1000));

          // Calculate estimated time remaining
          if (currentPreparedCount > 0 && currentPreparedCount < totalRecipients) {
            const elapsedTime = Date.now() - startTime;
            const emailsPerMs = currentPreparedCount / elapsedTime;
            const remainingEmails = totalRecipients - currentPreparedCount;
            const estimatedRemainingMs = remainingEmails / emailsPerMs;
            
            if (estimatedRemainingMs < 60000) {
              setEstimatedTimeRemaining(`~${Math.ceil(estimatedRemainingMs / 1000)}s remaining`);
            } else {
              setEstimatedTimeRemaining(`~${Math.ceil(estimatedRemainingMs / 60000)}m remaining`);
            }
          }

          // Check if preparation is complete
          if (campaign.status === 'prepared' && !completionTimer) {
            console.log('✅ Campaign preparation completed!');
            setStatus('completed');
            clearInterval(intervalId);
            
            // Show completion state for 3 seconds before closing
            const timer = window.setTimeout(() => {
              onComplete();
            }, 3000);
            setCompletionTimer(timer);
            
          } else if (campaign.status === 'failed') {
            console.log('❌ Campaign preparation failed!');
            setStatus('failed');
            clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('Error in progress check:', error);
      }
    };

    // Check immediately and then every 1.5 seconds (slower polling)
    checkProgress();
    intervalId = setInterval(checkProgress, 1500);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (completionTimer) {
        clearTimeout(completionTimer);
      }
    };
  }, [campaignId, totalRecipients, startTime, onComplete, completionTimer]);

  const progressPercentage = Math.round((preparedCount / totalRecipients) * 100);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {status === 'preparing' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
          {status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
          
          {status === 'preparing' && 'Preparing Campaign...'}
          {status === 'completed' && 'Campaign Prepared Successfully!'}
          {status === 'failed' && 'Preparation Failed'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-muted-foreground">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Email Counter */}
        <div className="text-center py-4">
          <div className="text-3xl font-bold text-primary">
            {preparedCount.toLocaleString()}
            <span className="text-muted-foreground">/{totalRecipients.toLocaleString()}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            emails prepared
          </div>
        </div>

        {/* Status Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Current Batch</div>
            <Badge variant="secondary">
              {currentBatch} / {totalBatches}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Status</div>
            <Badge variant={status === 'preparing' ? 'default' : status === 'completed' ? 'default' : 'destructive'}>
              {status === 'preparing' && '🔄 Processing'}
              {status === 'completed' && '✅ Ready'}
              {status === 'failed' && '❌ Failed'}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Time</div>
            <Badge variant="outline" className="text-xs">
              {status === 'preparing' ? estimatedTimeRemaining || 'Calculating...' : 
               status === 'completed' ? 'Completed' : 'Failed'}
            </Badge>
          </div>
        </div>

        {/* Real-time Processing Indicator */}
        {status === 'preparing' && (
          <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg border">
            <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-blue-700">
              Live preparation in progress - Processing emails with rotation...
            </span>
          </div>
        )}

        {/* Success Message */}
        {status === 'completed' && (
          <div className="flex items-center justify-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-green-700">
              All {totalRecipients.toLocaleString()} emails prepared successfully! Ready to send.
            </span>
          </div>
        )}

        {/* Cancel Button - only show while preparing */}
        {status === 'preparing' && (
          <div className="flex justify-center pt-4">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="text-sm"
            >
              Cancel Preparation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignPreparationProgress;
