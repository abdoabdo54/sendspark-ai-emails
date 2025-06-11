
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Zap, Rocket, AlertTriangle, TestTube, Target, RotateCcw } from 'lucide-react';

interface AdvancedConfigurationPanelProps {
  // Sending Mode
  sendingMode: 'controlled' | 'fast' | 'zero-delay';
  onSendingModeChange: (mode: 'controlled' | 'fast' | 'zero-delay') => void;
  
  // Test-After
  useTestAfter: boolean;
  onUseTestAfterChange: (value: boolean) => void;
  testAfterEmail: string;
  onTestAfterEmailChange: (value: string) => void;
  testAfterCount: number;
  onTestAfterCountChange: (value: number) => void;
  
  // Tracking
  trackingEnabled: boolean;
  onTrackingEnabledChange: (value: boolean) => void;
  
  // Rotation
  useFromRotation: boolean;
  onUseFromRotationChange: (value: boolean) => void;
  useSubjectRotation: boolean;
  onUseSubjectRotationChange: (value: boolean) => void;
  
  // Status
  hasAccounts: boolean;
  hasFunctions: boolean;
  estimatedTime: string;
}

const AdvancedConfigurationPanel = ({
  sendingMode,
  onSendingModeChange,
  useTestAfter,
  onUseTestAfterChange,
  testAfterEmail,
  onTestAfterEmailChange,
  testAfterCount,
  onTestAfterCountChange,
  trackingEnabled,
  onTrackingEnabledChange,
  useFromRotation,
  onUseFromRotationChange,
  useSubjectRotation,
  onUseSubjectRotationChange,
  hasAccounts,
  hasFunctions,
  estimatedTime
}: AdvancedConfigurationPanelProps) => {
  
  return (
    <div className="space-y-4">
      {/* Sending Mode Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Sending Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rotation Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm">From Name Rotation</Label>
                <p className="text-xs text-gray-600">Rotate sender names</p>
              </div>
              <Switch
                checked={useFromRotation}
                onCheckedChange={onUseFromRotationChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm">Subject Rotation</Label>
                <p className="text-xs text-gray-600">Rotate email subjects</p>
              </div>
              <Switch
                checked={useSubjectRotation}
                onCheckedChange={onUseSubjectRotationChange}
              />
            </div>
          </div>

          <Separator />

          {/* Sending Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sending Mode</Label>
            <RadioGroup 
              value={sendingMode} 
              onValueChange={(value: 'controlled' | 'fast' | 'zero-delay') => onSendingModeChange(value)}
              className="grid grid-cols-1 gap-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="controlled" id="controlled" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <Label htmlFor="controlled" className="font-medium text-sm">Controlled</Label>
                    <Badge variant="secondary" className="text-xs">2s delay</Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Standard rate limits, reliable delivery</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="fast" id="fast" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-600" />
                    <Label htmlFor="fast" className="font-medium text-sm">Fast</Label>
                    <Badge variant="secondary" className="text-xs">0.5s delay</Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">High-speed parallel dispatch</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="zero-delay" id="zero-delay" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-red-600" />
                    <Label htmlFor="zero-delay" className="font-medium text-sm">Zero Delay</Label>
                    <Badge variant="destructive" className="text-xs">No delay</Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Maximum speed, no rate limiting</p>
                </div>
              </div>
            </RadioGroup>

            {sendingMode === 'zero-delay' && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-xs">
                  <strong>Maximum Speed Mode:</strong> No delays between emails. Monitor your providers for rate limits.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test-After Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Test-After Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="useTestAfter" className="text-sm">Enable Test-After</Label>
            <Switch
              id="useTestAfter"
              checked={useTestAfter}
              onCheckedChange={onUseTestAfterChange}
            />
          </div>
          
          {useTestAfter && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="testAfterEmail" className="text-sm">Test Email</Label>
                  <Input
                    id="testAfterEmail"
                    type="email"
                    value={testAfterEmail}
                    onChange={(e) => onTestAfterEmailChange(e.target.value)}
                    placeholder="test@example.com"
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="testAfterCount" className="text-sm">Test Every X Emails</Label>
                  <Input
                    id="testAfterCount"
                    type="number"
                    min="1"
                    max="1000"
                    value={testAfterCount}
                    onChange={(e) => onTestAfterCountChange(parseInt(e.target.value) || 1)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Email Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">Track Opens & Clicks</Label>
              <p className="text-xs text-gray-600">Monitor email engagement</p>
            </div>
            <Switch
              checked={trackingEnabled}
              onCheckedChange={onTrackingEnabledChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Alert className={hasAccounts && hasFunctions ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
        <Target className="h-4 w-4" />
        <AlertDescription>
          {hasAccounts && hasFunctions ? (
            <span className="text-green-800 text-sm">
              <strong>✅ Ready to Launch</strong>
              {estimatedTime && ` • Estimated time: ${estimatedTime}`}
            </span>
          ) : (
            <div className="text-yellow-800 text-sm">
              <strong>⚠️ Setup Required:</strong>
              {!hasFunctions && " Configure Cloud Functions"}
              {!hasFunctions && !hasAccounts && " • "}
              {!hasAccounts && " Select Email Accounts"}
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AdvancedConfigurationPanel;
