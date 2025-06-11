
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Zap, Users, Clock, CheckCircle } from 'lucide-react';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const SmartConfig = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { functions } = useGcfFunctions(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  
  const [emailVolume, setEmailVolume] = useState(10000);
  const [smartConfig, setSmartConfig] = useState({
    recommendedFunctions: 0,
    recommendedAccounts: 0,
    estimatedTime: '',
    emailsPerFunction: 0,
    emailsPerAccount: 0
  });

  const activeFunctions = functions.filter(f => f.enabled);
  const activeAccounts = accounts.filter(a => a.is_active);

  const calculateOptimalConfig = () => {
    if (emailVolume <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid email volume",
        variant: "destructive"
      });
      return;
    }

    // Smart recommendations based on volume
    let recommendedFunctions = Math.min(
      Math.max(1, Math.ceil(emailVolume / 5000)), // 5k emails per function
      Math.max(1, activeFunctions.length) // Use available functions
    );

    let recommendedAccounts = Math.min(
      Math.max(2, Math.ceil(emailVolume / 2000)), // 2k emails per account
      Math.max(1, activeAccounts.length) // Use available accounts
    );

    const emailsPerFunction = Math.ceil(emailVolume / recommendedFunctions);
    const emailsPerAccount = Math.ceil(emailVolume / recommendedAccounts);

    // Estimate time (assuming 1000 emails per minute per function in parallel)
    const estimatedMinutes = Math.ceil(emailsPerFunction / 1000);
    const estimatedTime = estimatedMinutes < 60 
      ? `~${estimatedMinutes} minutes`
      : `~${Math.ceil(estimatedMinutes / 60)} hours`;

    setSmartConfig({
      recommendedFunctions,
      recommendedAccounts,
      estimatedTime,
      emailsPerFunction,
      emailsPerAccount
    });

    // Save to localStorage for campaign composer
    localStorage.setItem('smartConfig', JSON.stringify({
      emailVolume,
      recommendedFunctions,
      recommendedAccounts,
      estimatedTime
    }));

    toast({
      title: "✅ Configuration Calculated",
      description: `Optimal setup for ${emailVolume.toLocaleString()} emails calculated`
    });
  };

  const applyConfiguration = () => {
    localStorage.setItem('smartConfig', JSON.stringify(smartConfig));
    toast({
      title: "✅ Configuration Applied",
      description: "Smart config will be used in campaign composer"
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Calculator className="w-8 h-8 text-blue-600" />
            SmartConfig Engine
          </h1>
          <p className="text-gray-600 mt-2">
            Get optimal recommendations for your email campaign
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Campaign Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="volume">Total Email Volume</Label>
                <Input
                  id="volume"
                  type="number"
                  value={emailVolume}
                  onChange={(e) => setEmailVolume(Number(e.target.value))}
                  placeholder="10000"
                  className="text-lg"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Available Resources</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {activeFunctions.length}
                    </div>
                    <div className="text-sm text-gray-600">Cloud Functions</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {activeAccounts.length}
                    </div>
                    <div className="text-sm text-gray-600">Email Accounts</div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={calculateOptimalConfig}
                className="w-full"
                size="lg"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Calculate Optimal Config
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Smart Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {smartConfig.recommendedFunctions > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">
                        {smartConfig.recommendedFunctions}
                      </div>
                      <div className="text-sm text-gray-600">Functions Needed</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {smartConfig.emailsPerFunction.toLocaleString()} emails each
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">
                        {smartConfig.recommendedAccounts}
                      </div>
                      <div className="text-sm text-gray-600">Accounts Needed</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {smartConfig.emailsPerAccount.toLocaleString()} emails each
                      </div>
                    </div>
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <div className="text-lg font-semibold text-green-800">
                      Estimated Time: {smartConfig.estimatedTime}
                    </div>
                    <div className="text-sm text-green-600">
                      With parallel dispatch enabled
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold">Strategy Benefits:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Parallel processing across {smartConfig.recommendedFunctions} functions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Load balanced across {smartConfig.recommendedAccounts} accounts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>No serial bottlenecks</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={applyConfiguration}
                    className="w-full"
                    variant="default"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Apply This Configuration
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Enter email volume and click "Calculate Optimal Config"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/function-manager')}
              >
                Manage Functions
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/settings')}
              >
                Manage Accounts
              </Button>
              <Button 
                onClick={() => navigate('/')}
              >
                Start Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SmartConfig;
