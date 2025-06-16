
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Zap, Settings, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface SmartConfigurationPanelProps {
  smartConfigEnabled: boolean;
  onSmartConfigChange: (enabled: boolean) => void;
  useManualOverride: boolean;
  onManualOverrideChange: (enabled: boolean) => void;
  functionsToUse: number;
  onFunctionsToUseChange: (count: number) => void;
  accountsToUse: number;
  onAccountsToUseChange: (count: number) => void;
  smartOptimization: {
    accountLoadBalancing: boolean;
    deliveryOptimization: boolean;
    rateLimitAdjustment: boolean;
    failoverProtection: boolean;
  };
  onSmartOptimizationChange: (optimization: any) => void;
}

const SmartConfigurationPanel: React.FC<SmartConfigurationPanelProps> = ({
  smartConfigEnabled,
  onSmartConfigChange,
  useManualOverride,
  onManualOverrideChange,
  functionsToUse,
  onFunctionsToUseChange,
  accountsToUse,
  onAccountsToUseChange,
  smartOptimization,
  onSmartOptimizationChange
}) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { functions } = useGcfFunctions(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);

  const availableFunctions = functions.filter(func => func.enabled).length;
  const availableAccounts = accounts.filter(acc => acc.is_active).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Smart Configuration Engine - FULLY UPGRADED ⚡
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Smart Configuration</Label>
            <p className="text-sm text-gray-600">AI-powered optimization for best delivery rates</p>
          </div>
          <Switch checked={smartConfigEnabled} onCheckedChange={onSmartConfigChange} />
        </div>

        {smartConfigEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label>Use Manual Configuration Override</Label>
                <p className="text-sm text-gray-600">Manually control functions and accounts usage</p>
              </div>
              <Switch checked={useManualOverride} onCheckedChange={onManualOverrideChange} />
            </div>

            {useManualOverride && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Manual Override Configuration</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="functionsToUse">Functions to Use</Label>
                    <Input
                      id="functionsToUse"
                      type="number"
                      min="1"
                      max={availableFunctions}
                      value={functionsToUse}
                      onChange={(e) => onFunctionsToUseChange(Math.min(parseInt(e.target.value) || 1, availableFunctions))}
                      className="w-20"
                    />
                    <p className="text-sm text-gray-600">Available: {availableFunctions} functions</p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="accountsToUse">Accounts to Use</Label>
                    <Input
                      id="accountsToUse"
                      type="number"
                      min="0"
                      max={availableAccounts}
                      value={accountsToUse}
                      onChange={(e) => onAccountsToUseChange(Math.min(parseInt(e.target.value) || 0, availableAccounts))}
                      className="w-20"
                    />
                    <p className="text-sm text-gray-600">Selected: {accountsToUse} accounts</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 p-4 border rounded-lg bg-green-50">
              <h4 className="font-medium text-green-900">Optimization Features</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Account Load Balancing</Label>
                    <p className="text-sm text-gray-600">Distribute emails across accounts optimally</p>
                  </div>
                  <Switch 
                    checked={smartOptimization.accountLoadBalancing} 
                    onCheckedChange={(checked) => 
                      onSmartOptimizationChange({...smartOptimization, accountLoadBalancing: checked})
                    } 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Delivery Time Optimization</Label>
                    <p className="text-sm text-gray-600">Send at optimal times for each recipient</p>
                  </div>
                  <Switch 
                    checked={smartOptimization.deliveryOptimization} 
                    onCheckedChange={(checked) => 
                      onSmartOptimizationChange({...smartOptimization, deliveryOptimization: checked})
                    } 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Adaptive Rate Limiting</Label>
                    <p className="text-sm text-gray-600">Adjust sending speed based on provider response</p>
                  </div>
                  <Switch 
                    checked={smartOptimization.rateLimitAdjustment} 
                    onCheckedChange={(checked) => 
                      onSmartOptimizationChange({...smartOptimization, rateLimitAdjustment: checked})
                    } 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Failover Protection</Label>
                    <p className="text-sm text-gray-600">Automatic switching to backup accounts</p>
                  </div>
                  <Switch 
                    checked={smartOptimization.failoverProtection} 
                    onCheckedChange={(checked) => 
                      onSmartOptimizationChange({...smartOptimization, failoverProtection: checked})
                    } 
                  />
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Smart configuration uses machine learning to optimize your campaigns based on historical performance data and real-time analytics.
                </AlertDescription>
              </Alert>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartConfigurationPanel;
