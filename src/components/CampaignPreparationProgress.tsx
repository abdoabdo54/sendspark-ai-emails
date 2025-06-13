
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const startPreparation = async () => {
      try {
        console.log('🔧 Starting REAL campaign preparation for:', campaignId);
        
        // Find the campaign to get recipient count for progress estimation
        const campaign = campaigns.find(c => c.id === campaignId);
        const recipientText = campaign?.recipients || '';
        
        // Estimate recipient count for progress calculation
        let estimatedCount = 0;
        if (recipientText.includes(',')) {
          estimatedCount = recipientText.split(',').length;
        } else if (recipientText.includes('\n')) {
          estimatedCount = recipientText.split('\n').length;
        } else if (recipientText.includes(';')) {
          estimatedCount = recipientText.split(';').length;
        } else if (recipientText.trim()) {
          estimatedCount = 1;
        }
        
        setEmailCount(estimatedCount);
        setMessage(`Preparing ${estimatedCount} emails...`);
        
        // Simulate progress during actual preparation
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev < 90) {
              const increment = Math.random() * 15 + 5; // Random increment between 5-20
              return Math.min(prev + increment, 90);
            }
            return prev;
          });
        }, 800); // Update every 800ms to show realistic progress
        
        // Call the REAL preparation function
        const result = await prepareCampaign(campaignId);
        
        // Clear the progress simulation
        clearInterval(progressInterval);
        
        console.log('✅ Preparation completed:', result);
        
        // Set completion state
        setProgress(100);
        setStatus('completed');
        setMessage(`Successfully prepared ${estimatedCount} emails!`);
        
        // Wait 2 seconds to show completion before closing
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
            Processing {emailCount} email recipients
          </div>
        )}
      </div>

      {status === 'completed' && (
        <div className="text-center text-sm text-green-600">
          Campaign is now ready to send!
        </div>
      )}
    </div>
  );
};

export default CampaignPreparationProgress;
