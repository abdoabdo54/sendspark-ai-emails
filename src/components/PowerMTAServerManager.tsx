
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Server } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

const PowerMTAServerManager: React.FC = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const [showComingSoon, setShowComingSoon] = useState(false);

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-600">Please select an organization to manage PowerMTA servers.</p>
      </div>
    );
  }

  const handleShowComingSoon = () => {
    setShowComingSoon(true);
    toast.info('PowerMTA Server Management will be available after database migration is complete.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PowerMTA Servers</h3>
          <p className="text-sm text-gray-600">
            Manage PowerMTA servers for campaign distribution bridge
          </p>
        </div>
        <Button onClick={handleShowComingSoon}>
          <Plus className="w-4 h-4 mr-2" />
          Add PowerMTA Server
        </Button>
      </div>

      <Alert>
        <Server className="w-4 h-4" />
        <AlertDescription>
          PowerMTA servers act as a bridge to distribute campaigns using your SMTP and Apps Script sender accounts.
          The server must have PowerMTA installed and properly configured.
        </AlertDescription>
      </Alert>

      {showComingSoon && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertDescription>
            <strong>🚧 Coming Soon!</strong><br/>
            PowerMTA Server Management will be available once the database migration is complete.
            You'll be able to add servers with IP/Port/Password configuration.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col items-center justify-center h-32">
          <Server className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-gray-600">PowerMTA servers will appear here</p>
          <Badge variant="secondary" className="mt-2">
            Coming Soon
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default PowerMTAServerManager;
