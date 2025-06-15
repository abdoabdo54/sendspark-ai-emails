
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Server } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';

interface CampaignSendMethodSelectorProps {
  selectedMethod: 'cloud_functions' | 'powermta';
  onMethodChange: (method: 'cloud_functions' | 'powermta') => void;
  selectedPowerMTAServer?: string;
  onPowerMTAServerChange?: (serverId: string) => void;
}

const CampaignSendMethodSelector: React.FC<CampaignSendMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  selectedPowerMTAServer,
  onPowerMTAServerChange
}) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { servers } = usePowerMTAServers(currentOrganization?.id);
  
  const activeServers = servers.filter(server => server.is_active);
  const powerMTAAvailable = activeServers.length > 0;

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
                {!powerMTAAvailable && <Badge variant="secondary" className="text-xs">Setup Required</Badge>}
              </div>
              <div className="text-xs opacity-70">Bridge server for distributed sending</div>
            </div>
          </Button>
        </div>

        {selectedMethod === 'powermta' && powerMTAAvailable && onPowerMTAServerChange && (
          <div className="mt-4">
            <label className="text-sm font-medium mb-2 block">Select PowerMTA Server:</label>
            <div className="space-y-2">
              {activeServers.map((server) => (
                <Button
                  key={server.id}
                  variant={selectedPowerMTAServer === server.id ? 'default' : 'outline'}
                  onClick={() => onPowerMTAServerChange(server.id)}
                  className="w-full justify-start"
                  size="sm"
                >
                  <Server className="w-4 h-4 mr-2" />
                  {server.name} ({server.server_host})
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-gray-600">
          {selectedMethod === 'cloud_functions' && (
            "Direct sending using Google Cloud Functions - fast and reliable"
          )}
          {selectedMethod === 'powermta' && (
            powerMTAAvailable 
              ? "Campaigns will be pushed to PowerMTA server for distributed sending"
              : "Please add and configure PowerMTA servers in Settings → PowerMTA Servers"
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignSendMethodSelector;
