
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const SmartConfig = () => {
  const [totalEmails, setTotalEmails] = useState(50000);
  const [recommendedFunctions, setRecommendedFunctions] = useState(10);
  const [recommendedAccounts, setRecommendedAccounts] = useState(25);
  const [estimatedTime, setEstimatedTime] = useState('');

  useEffect(() => {
    const funcs = Math.max(1, Math.ceil(totalEmails / 5000));
    const accts = Math.max(1, Math.ceil(totalEmails / 2000));
    setRecommendedFunctions(funcs);
    setRecommendedAccounts(accts);
    const secs = Math.round((totalEmails / (funcs * 5000)) * 12 + 2);
    setEstimatedTime(`${secs} seconds`);
  }, [totalEmails]);

  const applyConfig = () => {
    const cfg = {
      totalEmails,
      recommendedFunctions,
      recommendedAccounts
    };
    localStorage.setItem('smartConfig', JSON.stringify(cfg));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Smart Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="emails">Total Emails</Label>
            <Input id="emails" type="number" value={totalEmails} onChange={e => setTotalEmails(parseInt(e.target.value || '0'))} />
          </div>
          <p className="text-sm text-gray-600">
            {totalEmails.toLocaleString()} emails → use {recommendedFunctions} GCFs + {recommendedAccounts} accounts → ~{estimatedTime}
          </p>
          <Button onClick={applyConfig} className="w-full">Apply Config</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartConfig;
