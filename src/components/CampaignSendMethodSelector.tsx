
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Server } from 'lucide-react';

interface CampaignSendMethodSelectorProps {
  selectedMethod: 'cloud_functions' | 'powermta';
  onMethodChange: (method: 'cloud_functions' | 'powermta') => void;
  powerMTAAvailable?: boolean;
}

const CampaignSendMethodSelector: React.FC<CampaignSendMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  powerMTAAvailable = false
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Campaign Send Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            variant={selectedMethod === 'cloud_functions' ? 'default' : 'outline'}
            onClick={() => onMethodChange('cloud_functions')}
            className="w-full h-auto p-4 flex flex-col items-center"
          >
            <Cloud className="w-6 h-6 mb-2" />
            <div className="text-center">
              <div className="font-medium">Cloud Functions</div>
              <div className="text-xs opacity-70">Direct sending via Google Cloud</div>
            </div>
          </Button>
          
          <Button
            variant={selectedMethod === 'powermta' ? 'default' : 'outline'}
            onClick={() => onMethodChange('powermta')}
            className="w-full h-auto p-4 flex flex-col items-center"
            disabled={!powerMTAAvailable}
          >
            <Server className="w-6 h-6 mb-2" />
            <div className="text-center">
              <div className="font-medium flex items-center gap-1">
                PowerMTA Server
                {!powerMTAAvailable && <Badge variant="secondary" className="text-xs">Soon</Badge>}
              </div>
              <div className="text-xs opacity-70">Bridge server for distributed sending</div>
            </div>
          </Button>
        </div>
        
        <div className="text-xs text-gray-600">
          {selectedMethod === 'cloud_functions' && (
            "Direct sending using Google Cloud Functions - fast and reliable"
          )}
          {selectedMethod === 'powermta' && (
            powerMTAAvailable 
              ? "Campaigns will be pushed to PowerMTA server for distributed sending"
              : "PowerMTA integration will be available after database setup"
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignSendMethodSelector;
