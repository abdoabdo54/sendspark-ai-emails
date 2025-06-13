
import React, { useState, useEffect, useRef } from 'react';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';

interface CampaignPreparationProgressProps {
  campaignId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

const CampaignPreparationProgress: React.FC<CampaignPreparationProgressProps> = ({
  campaignId,
  onComplete,
  onError
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'completed' | 'error'>('preparing');
  const [message, setMessage] = useState('Starting preparation...');
  const [emailCount, setEmailCount] = useState(0);
  const { prepareCampaign, campaigns } = useCampaigns();
  const preparationStarted = useRef(false);

  useEffect(() => {
    // Prevent multiple calls
    if (preparationStarted.current) {
      return;
    }
    preparationStarted.current = true;

    const startPreparation = async () => {
      try {
        console.log('🔧 Starting campaign preparation for:', campaignId);
        
        // Find the campaign to estimate recipient count
        const campaign = campaigns.find(c => c.id === campaignId);
        const recipientText = campaign?.recipients || '';
        
        // Quick estimate for progress display
        let estimatedCount = 0;
        if (recipientText.includes(',') || recipientText.includes('\n') || recipientText.includes(';')) {
          const separators = [',', '\n', ';'];
          for (const sep of separators) {
            if (recipientText.includes(sep)) {
              estimatedCount = Math.max(estimatedCount, recipientText.split(sep).length);
            }
          }
        } else if (recipientText.trim()) {
          estimatedCount = 1;
        }
        
        setEmailCount(estimatedCount);
        setMessage(`Preparing ${estimatedCount.toLocaleString()} emails...`);
        
        // Start progress animation
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev < 80) {
              return prev + Math.random() * 15 + 5;
            }
            return prev;
          });
        }, 500);
        
        // Call the preparation function
        const result = await prepareCampaign(campaignId);
        
        // Clear progress interval
        clearInterval(progressInterval);
        
        console.log('✅ Preparation completed:', result);
        
        // Show completion
        setProgress(100);
        setStatus('completed');
        setMessage(`Successfully prepared ${result.emailCount || estimatedCount} emails!`);
        
        // Auto-close after showing completion
        setTimeout(() => {
          onComplete();
        }, 2000);
        
      } catch (error: any) {
        console.error('❌ Preparation failed:', error);
        setStatus('error');
        setMessage(`Preparation failed: ${error.message}`);
        onError(error.message);
      }
    };

    startPreparation();
  }, [campaignId, prepareCampaign, campaigns, onComplete, onError]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        {status === 'preparing' && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-lg font-medium">Preparing Campaign</span>
          </div>
        )}
        
        {status === 'completed' && (
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-lg font-medium text-green-600">Preparation Complete!</span>
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex items-center justify-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-lg font-medium text-red-600">Preparation Failed</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="w-full h-3" />
        <div className="flex justify-between text-sm text-gray-600">
          <span>{message}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        {emailCount > 0 && (
          <div className="text-center text-sm text-gray-500">
            Processing {emailCount.toLocaleString()} email recipients
          </div>
        )}
      </div>

      {status === 'completed' && (
        <div className="text-center text-sm text-green-600">
          Campaign is now ready to send!
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-center text-sm text-red-600">
          Please check the campaign details and try again.
        </div>
      )}
    </div>
  );
};

export default CampaignPreparationProgress;
