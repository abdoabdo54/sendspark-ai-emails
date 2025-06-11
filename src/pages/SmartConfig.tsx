
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Calculator, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const SmartConfig = () => {
  const navigate = useNavigate();
  const [totalEmails, setTotalEmails] = useState(50000);
  const [recommendedFunctions, setRecommendedFunctions] = useState(10);
  const [recommendedAccounts, setRecommendedAccounts] = useState(25);
  const [estimatedTimeControlled, setEstimatedTimeControlled] = useState('');
  const [estimatedTimeFast, setEstimatedTimeFast] = useState('');
  const [estimatedTimeZeroDelay, setEstimatedTimeZeroDelay] = useState('');

  useEffect(() => {
    // Calculate optimal configuration
    const funcs = Math.max(1, Math.min(50, Math.ceil(totalEmails / 5000))); // Max 50 functions
    const accts = Math.max(1, Math.min(100, Math.ceil(totalEmails / 2000))); // Max 100 accounts
    
    setRecommendedFunctions(funcs);
    setRecommendedAccounts(accts);

    // Calculate estimated times for different modes
    const emailsPerFunction = Math.ceil(totalEmails / funcs);
    
    // Controlled mode: ~200 emails/minute per function
    const controlledMinutes = Math.ceil(emailsPerFunction / 200);
    setEstimatedTimeControlled(`${controlledMinutes} minutes`);
    
    // Fast mode: ~1000 emails/minute per function
    const fastSeconds = Math.ceil(emailsPerFunction / 16.67); // ~1000/min = 16.67/sec
    setEstimatedTimeFast(`${fastSeconds} seconds`);
    
    // Zero delay mode: ~5000+ emails/minute per function
    const zeroDelaySeconds = Math.max(1, Math.ceil(emailsPerFunction / 83.33)); // ~5000/min = 83.33/sec
    setEstimatedTimeZeroDelay(`${zeroDelaySeconds} seconds`);
  }, [totalEmails]);

  const applyConfig = () => {
    const config = {
      totalEmails,
      recommendedFunctions,
      recommendedAccounts,
      appliedAt: new Date().toISOString()
    };
    
    localStorage.setItem('smartConfig', JSON.stringify(config));
    
    toast({
      title: "Configuration Applied!",
      description: `Optimal settings saved: ${recommendedFunctions} functions, ${recommendedAccounts} accounts`,
    });
    
    // Navigate to main page to use the configuration
    navigate('/');
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Smart Configuration Engine
          </h1>
          <p className="text-gray-600">
            Get optimal recommendations for your email campaign volume
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Campaign Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="emails">Total Emails to Send</Label>
                <Input 
                  id="emails" 
                  type="number" 
                  value={totalEmails} 
                  onChange={e => setTotalEmails(parseInt(e.target.value || '0'))}
                  min="1"
                  max="1000000"
                />
              </div>
              
              <div className="pt-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {formatNumber(totalEmails)} emails
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Optimal Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {recommendedFunctions}
                  </div>
                  <div className="text-sm text-gray-600">
                    Cloud Functions
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {recommendedAccounts}
                  </div>
                  <div className="text-sm text-gray-600">
                    Sender Accounts
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 text-center">
                ~{Math.ceil(totalEmails / recommendedFunctions).toLocaleString()} emails per function
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Estimated Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Estimated Delivery Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Controlled Mode</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {estimatedTimeControlled}
                </div>
                <p className="text-sm text-gray-600">
                  Standard rate limits
                </p>
              </div>
              
              <div className="p-4 border rounded-lg bg-orange-50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">Fast Mode</span>
                </div>
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {estimatedTimeFast}
                </div>
                <p className="text-sm text-gray-600">
                  High-speed parallel
                </p>
              </div>
              
              <div className="p-4 border rounded-lg bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-red-600" />
                  <span className="font-medium">Zero Delay</span>
                </div>
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {estimatedTimeZeroDelay}
                </div>
                <p className="text-sm text-gray-600">
                  Maximum speed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-lg font-medium">
                📧 {formatNumber(totalEmails)} emails → 
                ⚡ {recommendedFunctions} functions + 
                👥 {recommendedAccounts} accounts → 
                🚀 {estimatedTimeZeroDelay} (Zero Delay Mode)
              </div>
              
              <Separator />
              
              <div className="flex justify-center gap-4">
                <Button onClick={applyConfig} size="lg" className="px-8">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Apply This Configuration
                </Button>
                
                <Button variant="outline" onClick={() => navigate('/')} size="lg">
                  Back to Campaigns
                </Button>
              </div>
              
              <p className="text-sm text-gray-500">
                This configuration will be auto-filled in your campaign composer
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SmartConfig;
