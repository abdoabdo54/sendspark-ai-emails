
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TestTube } from 'lucide-react';

interface TestAfterSectionProps {
  useTestAfter: boolean;
  onUseTestAfterChange: (value: boolean) => void;
  testAfterEmail: string;
  onTestAfterEmailChange: (value: string) => void;
  testAfterCount: number;
  onTestAfterCountChange: (value: number) => void;
}

const TestAfterSection: React.FC<TestAfterSectionProps> = ({
  useTestAfter,
  onUseTestAfterChange,
  testAfterEmail,
  onTestAfterEmailChange,
  testAfterCount,
  onTestAfterCountChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Test-After Email Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="useTestAfter">Enable Test-After Email</Label>
          <Switch
            id="useTestAfter"
            checked={useTestAfter}
            onCheckedChange={onUseTestAfterChange}
          />
        </div>
        
        {useTestAfter && (
          <>
            <div className="space-y-2">
              <Label htmlFor="testAfterEmail">Test Email Address</Label>
              <Input
                id="testAfterEmail"
                type="email"
                value={testAfterEmail}
                onChange={(e) => onTestAfterEmailChange(e.target.value)}
                placeholder="test@example.com"
                required
              />
              <p className="text-sm text-gray-600">
                This email will receive test messages during the campaign
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="testAfterCount">Send Test After Every X Emails</Label>
              <Input
                id="testAfterCount"
                type="number"
                min="1"
                max="1000"
                value={testAfterCount}
                onChange={(e) => onTestAfterCountChange(parseInt(e.target.value) || 1)}
                placeholder="100"
              />
              <p className="text-sm text-gray-600">
                A test email will be sent after every {testAfterCount} emails are delivered
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TestAfterSection;
