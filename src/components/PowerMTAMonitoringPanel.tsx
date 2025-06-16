
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, Play, Pause, Eye, RefreshCw, Settings, 
  Check, X, Mail, AlertCircle 
} from 'lucide-react';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface PowerMTAMonitoringPanelProps {
  monitoringEnabled: boolean;
  onMonitoringEnabledChange: (enabled: boolean) => void;
}

const PowerMTAMonitoringPanel: React.FC<PowerMTAMonitoringPanelProps> = ({
  monitoringEnabled,
  onMonitoringEnabledChange
}) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { servers: powerMTAServers } = usePowerMTAServers(currentOrganization?.id);
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  const activePowerMTAServers = powerMTAServers.filter(server => server.is_active);
  const selectedServer = activePowerMTAServers.find(server => server.id === selectedServerId);

  // Mock data for demonstration
  const activeJobs = [];
  const pausedJobs = [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="w-5 h-5" />
          PowerMTA Email Monitoring & Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Server Selection */}
        <div className="space-y-3">
          <Label>Select PowerMTA Server</Label>
          <Select value={selectedServerId} onValueChange={setSelectedServerId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a PowerMTA server to monitor" />
            </SelectTrigger>
            <SelectContent>
              {activePowerMTAServers.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  {server.name || 'Unnamed Server'} ({server.server_host || 'No Host'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activePowerMTAServers.length === 0 && (
            <p className="text-sm text-amber-600">No active PowerMTA servers found. Please configure servers first.</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Real-time Monitoring</Label>
            <p className="text-sm text-gray-600">Monitor email jobs and control delivery</p>
          </div>
          <Switch 
            checked={monitoringEnabled} 
            onCheckedChange={onMonitoringEnabledChange}
            disabled={!selectedServerId}
          />
        </div>

        {selectedServer && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-2">Selected Server Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Name:</span>
                <span>{selectedServer.name || 'Unnamed Server'}</span>
              </div>
              <div className="flex justify-between">
                <span>Host:</span>
                <span>{selectedServer.server_host || 'No Host'}</span>
              </div>
              <div className="flex justify-between">
                <span>SSH Port:</span>
                <span>{selectedServer.ssh_port}</span>
              </div>
              <div className="flex justify-between">
                <span>Virtual MTA:</span>
                <span>{selectedServer.virtual_mta || 'default'}</span>
              </div>
              <div className="flex justify-between">
                <span>Job Pool:</span>
                <span>{selectedServer.job_pool || 'default'}</span>
              </div>
            </div>
          </div>
        )}

        {monitoringEnabled && selectedServerId ? (
          <div className="space-y-6">
            
            {/* Job Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Active Jobs</p>
                      <p className="text-xl font-bold">{activeJobs.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Pause className="w-4 h-4 text-yellow-600" />
                    <div>
                      <p className="text-sm text-gray-600">Paused Jobs</p>
                      <p className="text-xl font-bold">{pausedJobs.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Completed</p>
                      <p className="text-xl font-bold">1,234</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-red-600" />
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-xl font-bold">56</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Jobs Control */}
            <Card>
              <CardHeader>
                <CardTitle>Active Email Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {activeJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active email jobs</p>
                    <p className="text-sm">Jobs will appear here when campaigns are running</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Placeholder for active jobs */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Campaign: Summer Promotion</h4>
                          <p className="text-sm text-gray-600">Progress: 1,234 / 5,000 sent</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{width: '25%'}}></div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Server Status */}
            <Card>
              <CardHeader>
                <CardTitle>Server Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{selectedServer.name || 'Unnamed Server'}</h4>
                      <p className="text-sm text-gray-600">{selectedServer.server_host || 'No Host'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="default">Online</Badge>
                        <Badge variant="outline">Queue: 0</Badge>
                        <Badge variant="outline">Rate: 50/hr</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {!selectedServerId 
                ? "Please select a PowerMTA server to enable monitoring."
                : "Enable monitoring to view real-time email job status and control PowerMTA operations."
              }
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default PowerMTAMonitoringPanel;
