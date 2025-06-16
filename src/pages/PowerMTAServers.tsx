
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import PowerMTAServerManager from '@/components/PowerMTAServerManager';

const PowerMTAServers = () => {
  const { currentOrganization } = useSimpleOrganizations();

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <Server className="w-8 h-8 text-blue-600" />
              PowerMTA Servers
            </h1>
            <p className="text-gray-600 mt-2">
              Please select an organization to manage PowerMTA servers
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Server className="w-8 h-8 text-blue-600" />
            PowerMTA Servers
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your PowerMTA servers for campaign distribution
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Server Management
              <Badge variant="outline">Organization: {currentOrganization.name}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PowerMTAServerManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PowerMTAServers;
