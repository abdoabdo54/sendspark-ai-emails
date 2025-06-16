
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useMiddlewareController } from '@/hooks/useMiddlewareController';
import { MiddlewareConfig } from '@/types/middleware';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface MiddlewareControllerProps {
  campaignId?: string;
  onConfigChange?: (config: MiddlewareConfig) => void;
}

const MiddlewareController: React.FC<MiddlewareControllerProps> = ({
  campaignId,
  onConfigChange
}) => {
  const [config, setConfig] = useState<MiddlewareConfig>({
    appsScriptExecUrl: '',
    controlTableType: 'supabase',
    pollingInterval: 5000,
    maxConcurrency: 5,
    enabled: false
  });

  const {
    status,
    isProcessing,
    startMiddleware,
    stopMiddleware,
    pauseCampaign,
    resumeCampaign
  } = useMiddlewareController(config);

  const handleConfigUpdate = (updates: Partial<MiddlewareConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const getStatusColor = () => {
    if (status.isRunning) return 'bg-green-500';
    if (status.errors.length > 0) return 'bg-red-500';
    return 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Status Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            PowerMTA Middleware Status
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.activeJobs}</div>
              <div className="text-sm text-gray-600">Active Jobs</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{status.pausedJobs}</div>
              <div className="text-sm text-gray-600">Paused Jobs</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{status.completedJobs}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{status.failedJobs}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={status.isRunning ? 'default' : 'secondary'}>
                {status.isRunning ? 'Running' : 'Stopped'}
              </Badge>
              {isProcessing && (
                <Badge variant="outline" className="animate-pulse">
                  Processing...
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {!status.isRunning ? (
                <Button 
                  onClick={startMiddleware} 
                  size="sm" 
                  disabled={!config.enabled || !config.appsScriptExecUrl}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </Button>
              ) : (
                <Button onClick={stopMiddleware} size="sm" variant="outline">
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              )}
              
              {campaignId && (
                <>
                  <Button 
                    onClick={() => pauseCampaign(campaignId)} 
                    size="sm" 
                    variant="outline"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause Campaign
                  </Button>
                  <Button 
                    onClick={() => resumeCampaign(campaignId)} 
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Resume Campaign
                  </Button>
                </>
              )}
            </div>
          </div>

          {status.lastProcessedAt && (
            <div className="text-sm text-gray-500">
              Last processed: {new Date(status.lastProcessedAt).toLocaleString()}
            </div>
          )}

          {status.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                Recent Errors:
              </div>
              {status.errors.slice(-3).map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Middleware Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appsScriptUrl">Apps Script Execution URL</Label>
              <Input
                id="appsScriptUrl"
                value={config.appsScriptExecUrl}
                onChange={(e) => handleConfigUpdate({ appsScriptExecUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pollingInterval">Polling Interval (ms)</Label>
              <Input
                id="pollingInterval"
                type="number"
                value={config.pollingInterval}
                onChange={(e) => handleConfigUpdate({ pollingInterval: parseInt(e.target.value) || 5000 })}
                min="1000"
                step="1000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxConcurrency">Max Concurrent Jobs</Label>
              <Input
                id="maxConcurrency"
                type="number"
                value={config.maxConcurrency}
                onChange={(e) => handleConfigUpdate({ maxConcurrency: parseInt(e.target.value) || 5 })}
                min="1"
                max="20"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={config.enabled}
                onCheckedChange={(checked) => handleConfigUpdate({ enabled: checked })}
              />
              <Label htmlFor="enabled">Enable Middleware</Label>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>The middleware will poll for email jobs every {config.pollingInterval / 1000} seconds and process up to {config.maxConcurrency} emails concurrently.</p>
            <p>PowerMTA integration allows real-time pause/resume control via the dashboard.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MiddlewareController;
