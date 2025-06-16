
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Server, Edit, Trash2, RefreshCw } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import PowerMTAConfigForm from './PowerMTAConfigForm';

const PowerMTAServerManager: React.FC = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { servers, loading, addServer, updateServer, deleteServer, refetch } = usePowerMTAServers(currentOrganization?.id);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-600">Please select an organization to manage PowerMTA servers.</p>
      </div>
    );
  }

  const handleAddServer = async (name: string, config: any) => {
    try {
      await addServer({ 
        name, 
        ...config 
      });
      setShowAddForm(false);
    } catch (error) {
      // Error already handled in the hook
    }
  };

  const handleUpdateServer = async (name: string, config: any) => {
    if (!editingServer) return;
    
    try {
      await updateServer(editingServer.id, { 
        name, 
        ...config 
      });
      setEditingServer(null);
    } catch (error) {
      // Error already handled in the hook
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (confirm('Are you sure you want to delete this PowerMTA server?')) {
      await deleteServer(serverId);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingServer(null);
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add PowerMTA Server
          </Button>
        </div>
      </div>

      <Alert>
        <Server className="w-4 h-4" />
        <AlertDescription>
          PowerMTA servers act as a bridge to distribute campaigns using your SMTP and Apps Script sender accounts.
          The server must have PowerMTA installed and properly configured.
        </AlertDescription>
      </Alert>

      {(showAddForm || editingServer) && (
        <PowerMTAConfigForm
          onSubmit={editingServer ? handleUpdateServer : handleAddServer}
          onCancel={handleCancel}
          initialData={editingServer ? {
            name: editingServer.name,
            config: {
              server_host: editingServer.server_host,
              ssh_port: editingServer.ssh_port,
              username: editingServer.username,
              password: editingServer.password,
              api_port: editingServer.api_port,
              virtual_mta: editingServer.virtual_mta,
              job_pool: editingServer.job_pool
            }
          } : undefined}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>PowerMTA Servers ({servers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p>Loading servers...</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32">
              <Server className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-gray-600">No PowerMTA servers configured yet</p>
              <p className="text-sm text-gray-500 mt-1">Add your first server to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <div key={server.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{server.name}</h3>
                      <p className="text-sm text-slate-600">{server.server_host}:{server.ssh_port}</p>
                      <p className="text-xs text-slate-500">User: {server.username}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">PowerMTA</Badge>
                        <Badge variant={server.is_active ? "default" : "secondary"}>
                          {server.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {server.virtual_mta && (
                          <Badge variant="secondary">VirtualMTA: {server.virtual_mta}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingServer(server)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteServer(server.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PowerMTAServerManager;
