
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Server, TestTube, ExternalLink, Zap } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { toast } from 'sonner';

interface CampaignSendMethodSelectorProps {
  selectedMethod: 'cloud_functions' | 'powermta' | 'middleware';
  onMethodChange: (method: 'cloud_functions' | 'powermta' | 'middleware') => void;
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
  const { servers, loading } = usePowerMTAServers(currentOrganization?.id);
  
  const activeServers = servers.filter(server => server.is_active);
  const powerMTAAvailable = activeServers.length > 0;

  const handleTestPowerMTA = (server: any) => {
    const testUrl = `http://${server.server_host}:${server.api_port || 8080}`;
    window.open(testUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  };

  if (loading) {
    return (
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="text-center">Loading PowerMTA servers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-600" />
          Campaign Send Method
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            variant={selectedMethod === 'powermta' ? 'default' : 'outline'}
            onClick={() => onMethodChange('powermta')}
            className="h-auto p-4 flex flex-col items-center space-y-2"
            disabled={!powerMTAAvailable}
          >
            <Server className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold flex items-center gap-1">
                PowerMTA Server
                {!powerMTAAvailable && <Badge variant="secondary" className="text-xs">Setup Required</Badge>}
                {powerMTAAvailable && <Badge variant="default" className="text-xs">{activeServers.length} Available</Badge>}
              </div>
              <div className="text-xs opacity-70">SMTP Bridge Server</div>
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

        {selectedMethod === 'powermta' && powerMTAAvailable && onPowerMTAServerChange && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <label className="text-sm font-medium mb-3 block">Select PowerMTA Server:</label>
            <div className="space-y-2">
              {activeServers.map((server) => (
                <div key={server.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <Button
                    variant={selectedPowerMTAServer === server.id ? 'default' : 'outline'}
                    onClick={() => onPowerMTAServerChange(server.id)}
                    className="flex-1 justify-start mr-3"
                    size="sm"
                  >
                    <Server className="w-4 h-4 mr-2" />
                    {server.name} ({server.server_host})
                    {server.proxy_enabled && (
                      <Badge variant="outline" className="ml-2 text-xs">Proxy</Badge>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestPowerMTA(server)}
                    disabled={!server.api_port}
                    className="flex items-center gap-1"
                  >
                    <TestTube className="w-3 h-3" />
                    <ExternalLink className="w-3 h-3" />
                    Test
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-gray-600 bg-white p-3 rounded border">
          {selectedMethod === 'cloud_functions' && (
            "✨ Fast and reliable sending using Google Cloud Functions with your configured email accounts"
          )}
          {selectedMethod === 'powermta' && (
            powerMTAAvailable 
              ? `🚀 Campaigns will be pushed to PowerMTA server for high-volume distributed sending using SMTP and Apps Script accounts (${activeServers.length} servers available)`
              : "⚠️ Please add and configure PowerMTA servers in PowerMTA Servers section"
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
