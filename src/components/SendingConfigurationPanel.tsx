
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Zap, Clock, RotateCcw, Layers, Info } from 'lucide-react';

interface SendingConfigurationPanelProps {
  sendingMode: string;
  onSendingModeChange: (mode: string) => void;
  dispatchMethod: string;
  onDispatchMethodChange: (method: string) => void;
}

const SendingConfigurationPanel: React.FC<SendingConfigurationPanelProps> = ({
  sendingMode,
  onSendingModeChange,
  dispatchMethod,
  onDispatchMethodChange
}) => {
  const sendingModes = [
    {
      value: 'controlled',
      label: 'Controlled (2s delay)',
      description: 'Safe sending with 2 second delays between emails',
      icon: Clock,
      color: 'blue'
    },
    {
      value: 'fast',
      label: 'Fast (0.5s delay)',
      description: 'Faster sending with minimal delays',
      icon: Send,
      color: 'green'
    },
    {
      value: 'zero_delay',
      label: 'Zero Delay (Max Speed) ⚡',
      description: 'Maximum speed with no rate limits or timeouts',
      icon: Zap,
      color: 'red'
    }
  ];

  const dispatchMethods = [
    {
      value: 'parallel',
      label: 'Parallel (All functions) 🚀',
      description: 'Use all available functions simultaneously for maximum throughput',
      icon: Layers,
      color: 'purple'
    },
    {
      value: 'round_robin',
      label: 'Round Robin (Rotate accounts)',
      description: 'Rotate between accounts for balanced distribution',
      icon: RotateCcw,
      color: 'blue'
    },
    {
      value: 'sequential',
      label: 'Sequential',
      description: 'Send emails one by one in sequence',
      icon: Send,
      color: 'gray'
    }
  ];

  const selectedMode = sendingModes.find(mode => mode.value === sendingMode);
  const selectedDispatch = dispatchMethods.find(method => method.value === dispatchMethod);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Sending Configuration - FULLY UPGRADED ⚡
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Sending Mode Selection */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Sending Mode</Label>
            <p className="text-sm text-gray-600 mb-3">Control the speed and rate of email delivery</p>
          </div>
          
          <Select value={sendingMode} onValueChange={onSendingModeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select sending mode" />
            </SelectTrigger>
            <SelectContent>
              {sendingModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex items-center gap-2">
                    <mode.icon className={`w-4 h-4 text-${mode.color}-600`} />
                    <span>{mode.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedMode && (
            <div className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <selectedMode.icon className={`w-4 h-4 text-${selectedMode.color}-600`} />
                <span className="font-medium">{selectedMode.label}</span>
                <Badge variant="outline" className={`text-${selectedMode.color}-600`}>
                  {selectedMode.value === 'zero_delay' ? 'EXTREME' : 
                   selectedMode.value === 'fast' ? 'FAST' : 'SAFE'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{selectedMode.description}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Dispatch Method Selection */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Dispatch Method</Label>
            <p className="text-sm text-gray-600 mb-3">Choose how to distribute emails across functions and accounts</p>
          </div>
          
          <Select value={dispatchMethod} onValueChange={onDispatchMethodChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select dispatch method" />
            </SelectTrigger>
            <SelectContent>
              {dispatchMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  <div className="flex items-center gap-2">
                    <method.icon className={`w-4 h-4 text-${method.color}-600`} />
                    <span>{method.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDispatch && (
            <div className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <selectedDispatch.icon className={`w-4 h-4 text-${selectedDispatch.color}-600`} />
                <span className="font-medium">{selectedDispatch.label}</span>
                <Badge variant="outline" className={`text-${selectedDispatch.color}-600`}>
                  {selectedDispatch.value === 'parallel' ? 'MAX POWER' : 
                   selectedDispatch.value === 'round_robin' ? 'BALANCED' : 'SEQUENTIAL'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{selectedDispatch.description}</p>
            </div>
          )}
        </div>

        {/* Performance Warning for Zero Delay */}
        {sendingMode === 'zero_delay' && (
          <Alert className="border-red-200 bg-red-50">
            <Zap className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>⚡ EXTREME MODE:</strong> Zero Delay mode removes ALL rate limits and timeouts for maximum speed. 
              Use with caution and ensure your email providers can handle high-volume sending.
            </AlertDescription>
          </Alert>
        )}

        {/* Parallel + Zero Delay Warning */}
        {sendingMode === 'zero_delay' && dispatchMethod === 'parallel' && (
          <Alert className="border-purple-200 bg-purple-50">
            <Layers className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>🚀 MAXIMUM POWER MODE:</strong> You've selected the most aggressive configuration possible. 
              This will use all functions in parallel with zero delays for unprecedented sending speed.
            </AlertDescription>
          </Alert>
        )}

        {/* Configuration Summary */}
        <div className="p-4 border rounded-lg bg-blue-50">
          <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Sending Mode:</span>
              <span className="font-medium">{selectedMode?.label || 'Not selected'}</span>
            </div>
            <div className="flex justify-between">
              <span>Dispatch Method:</span>
              <span className="font-medium">{selectedDispatch?.label || 'Not selected'}</span>
            </div>
            <div className="flex justify-between">
              <span>Performance Level:</span>
              <span className="font-medium">
                {sendingMode === 'zero_delay' && dispatchMethod === 'parallel' ? '🚀 EXTREME' :
                 sendingMode === 'zero_delay' ? '⚡ VERY HIGH' :
                 sendingMode === 'fast' ? '🔥 HIGH' : '✅ SAFE'}
              </span>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            These settings control how your campaign will be executed. Higher performance modes may require 
            proper email provider configuration and sufficient sending limits.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default SendingConfigurationPanel;
