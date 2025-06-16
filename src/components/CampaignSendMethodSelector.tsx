
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, Server, TestTube, ExternalLink } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { toast } from 'sonner';

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

  const handleTestPowerMTA = (server: any) => {
    const testUrl = `http://${server.server_host}:${server.api_port || 25}`;
    
    // Open PowerMTA web interface in a new window
    const testWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (testWindow) {
      testWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PowerMTA Test - ${server.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 1px solid #eee;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .test-link {
              display: inline-block;
              background: #007bff;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 0;
            }
            .test-link:hover {
              background: #0056b3;
            }
            .status {
              padding: 10px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .loading { background: #fff3cd; color: #856404; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PowerMTA Connection Test</h1>
              <h2>${server.name}</h2>
            </div>
            
            <div class="info">
              <strong>Server:</strong> ${server.server_host}<br>
              <strong>Port:</strong> ${server.api_port || 25}<br>
              <strong>Test URL:</strong> ${testUrl}
            </div>
            
            <div id="status" class="status loading">
              🔍 Testing PowerMTA connection...
            </div>
            
            <a href="${testUrl}" target="_blank" class="test-link">
              🌐 Open PowerMTA Web Interface
            </a>
            
            <div style="margin-top: 20px;">
              <h3>How to verify:</h3>
              <ul>
                <li>Click the link above to open PowerMTA web interface</li>
                <li>If you see the PowerMTA login/dashboard, the server is working</li>
                <li>If the page doesn't load, check server configuration</li>
              </ul>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
              <button onclick="window.close()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close Window
              </button>
            </div>
          </div>
          
          <script>
            // Simulate connection test
            setTimeout(() => {
              const statusDiv = document.getElementById('status');
              
              // Try to load the PowerMTA interface
              const testFrame = document.createElement('iframe');
              testFrame.style.display = 'none';
              testFrame.src = '${testUrl}';
              
              testFrame.onload = () => {
                statusDiv.className = 'status success';
                statusDiv.innerHTML = '✅ PowerMTA server appears to be accessible';
              };
              
              testFrame.onerror = () => {
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '❌ Unable to connect to PowerMTA server';
              };
              
              document.body.appendChild(testFrame);
              
              // Fallback timeout
              setTimeout(() => {
                if (statusDiv.innerHTML.includes('Testing')) {
                  statusDiv.className = 'status error';
                  statusDiv.innerHTML = '⚠️ Connection test timed out - please check manually';
                }
              }, 5000);
              
            }, 1000);
          </script>
        </body>
        </html>
      `);
      testWindow.document.close();
    } else {
      toast.error('Unable to open test window. Please check your popup blocker.');
    }
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-600" />
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
              </div>
              <div className="text-xs opacity-70">SMTP Bridge Server</div>
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
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestPowerMTA(server)}
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
              ? "🚀 Campaigns will be pushed to PowerMTA server for high-volume distributed sending using SMTP and Apps Script accounts"
              : "⚠️ Please add and configure PowerMTA servers in Settings → PowerMTA Servers"
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignSendMethodSelector;
