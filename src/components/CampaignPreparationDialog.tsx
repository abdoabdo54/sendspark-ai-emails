import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CampaignPreparationProgress from './CampaignPreparationProgress';

interface CampaignPreparationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
}

const CampaignPreparationDialog: React.FC<CampaignPreparationDialogProps> = ({
  isOpen,
  onClose,
  campaignId
}) => {
  const handleComplete = () => {
    console.log('✅ Preparation completed successfully');
    onClose();
  };

  const handleError = (error: string) => {
    console.error('❌ Preparation failed:', error);
    // Keep dialog open to show error state
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preparing Campaign</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <CampaignPreparationProgress
            campaignId={campaignId}
            onComplete={handleComplete}
            onError={handleError}
          />
        </div>

        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignPreparationDialog;
