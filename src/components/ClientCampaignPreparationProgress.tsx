
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2, Cpu } from 'lucide-react';

interface ClientCampaignPreparationProgressProps {
  isProcessing: boolean;
  progress: number;
  currentBatch: number;
  totalBatches: number;
  emailCount: number;
  onComplete?: () => void;
  status: 'preparing' | 'completed' | 'error';
  message: string;
}

const ClientCampaignPreparationProgress: React.FC<ClientCampaignPreparationProgressProps> = ({
  isProcessing,
  progress,
  currentBatch,
  totalBatches,
  emailCount,
  status,
  message
}) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        {status === 'preparing' && (
          <div className="flex items-center justify-center space-x-2">
            <Cpu className="w-5 h-5 animate-pulse text-blue-500" />
            <span className="text-lg font-medium">Client-Side Processing</span>
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
        
        {isProcessing && totalBatches > 1 && (
          <div className="text-center text-sm text-blue-600">
            Processing batch {currentBatch} of {totalBatches}
          </div>
        )}
        
        {emailCount > 0 && (
          <div className="text-center text-sm text-gray-500">
            🖥️ Processing {emailCount.toLocaleString()} emails locally (no server limits!)
          </div>
        )}
      </div>

      {status === 'completed' && (
        <div className="text-center text-sm text-green-600 space-y-1">
          <div>✅ Campaign prepared successfully on your device!</div>
          <div>🚀 Ready to send with perfect distribution</div>
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

export default ClientCampaignPreparationProgress;
