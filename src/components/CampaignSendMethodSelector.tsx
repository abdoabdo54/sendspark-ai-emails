
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Zap } from 'lucide-react';

interface CampaignSendMethodSelectorProps {
  selectedMethod: 'cloud_functions' | 'middleware';
  onMethodChange: (method: 'cloud_functions' | 'middleware') => void;
}

const CampaignSendMethodSelector: React.FC<CampaignSendMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange
}) => {
  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Campaign Send Method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant={selectedMethod === 'cloud_functions' ? 'default' : 'outline'}
            onClick={() => onMethodChange('cloud_functions')}
            className="h-auto p-4 flex flex-col items-center space-y-2"
          >
            <Cloud className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold">Google Cloud Functions</div>
              <div className="text-xs opacity-70">Direct cloud sending</div>
            </div>
          </Button>

          <Button
            variant={selectedMethod === 'middleware' ? 'default' : 'outline'}
            onClick={() => onMethodChange('middleware')}
            className="h-auto p-4 flex flex-col items-center space-y-2"
          >
            <Zap className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold flex items-center gap-1">
                PowerMTA Middleware
                <Badge variant="outline" className="text-xs">New</Badge>
              </div>
              <div className="text-xs opacity-70">Apps Script + PowerMTA Control</div>
            </div>
          </Button>
        </div>
        
        <div className="text-xs text-gray-600 bg-white p-3 rounded border">
          {selectedMethod === 'cloud_functions' && (
            "✨ Fast and reliable sending using Google Cloud Functions with your configured email accounts"
          )}
          {selectedMethod === 'middleware' && (
            "⚡ Advanced middleware that uses PowerMTA for monitoring, pausing, and resuming while sending emails via Google Apps Script. Best of both worlds!"
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignSendMethodSelector;
