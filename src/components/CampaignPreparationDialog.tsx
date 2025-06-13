
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CampaignPreparationProgress from './CampaignPreparationProgress';

interface CampaignPreparationDialogProps {
  open: boolean;
  campaignId: string;
  totalRecipients: number;
  onComplete: () => void;
  onCancel: () => void;
}

const CampaignPreparationDialog = ({
  open,
  campaignId,
  totalRecipients,
  onComplete,
  onCancel
}: CampaignPreparationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only allow closing via cancel button or completion
      if (!isOpen) {
        onCancel();
      }
    }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-center">Campaign Preparation</DialogTitle>
        </DialogHeader>
        
        <CampaignPreparationProgress
          campaignId={campaignId}
          totalRecipients={totalRecipients}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CampaignPreparationDialog;
