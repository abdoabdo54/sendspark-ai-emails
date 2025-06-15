
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Server, Edit, Trash2, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import PowerMTAConfigForm from './PowerMTAConfigForm';
import { testPowerMTAConnection } from '@/utils/powerMTASender';

interface PowerMTAServer {
  id: string;
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  api_port: number;
  virtual_mta: string;
  job_pool: string;
  is_active: boolean;
  created_at: string;
}

const PowerMTAServerManager: React.FC = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const [servers, setServers] = useState<PowerMTAServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<PowerMTAServer | null>(null);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, [currentOrganization]);

  const loadServers = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('powermta_servers')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load PowerMTA servers');
      console.error('Error loading PowerMTA servers:', error);
    } else {
      setServers(data || []);
    }
    setLoading(false);
  };

  const handleSaveServer = async (config: any) => {
    try {
      if (editingServer) {
        // Update existing server
        const { error } = await supabase
          .from('powermta_servers')
          .update({
            name: config.name,
            server_host: config.server_host,
            ssh_port: config.ssh_port,
            username: config.username,
            password: config.password,
            api_port: config.api_port,
            virtual_mta: config.virtual_mta,
            job_pool: config.job_pool
          })
          .eq('id', editingServer.id);

        if (error) throw error;
        toast.success('PowerMTA server updated successfully');
      } else {
        // Create new server
        const { error } = await supabase
          .from('powermta_servers')
          .insert({
            organization_id: currentOrganization?.id,
            name: config.name,
            server_host: config.server_host,
            ssh_port: config.ssh_port,
            username: config.username,
            password: config.password,
            api_port: config.api_port,
            virtual_mta: config.virtual_mta,
            job_pool: config.job_pool,
            is_active: true
          });

        if (error) throw error;
        toast.success('PowerMTA server added successfully');
      }

      setShowAddForm(false);
      setEditingServer(null);
      loadServers();
    } catch (error) {
      toast.error('Failed to save PowerMTA server');
      console.error('Error saving PowerMTA server:', error);
    }
  };

  const handleTestServer = async (server: PowerMTAServer) => {
    setTestingServerId(server.id);
    
    try {
      const result = await testPowerMTAConnection({
        name: server.name,
        server_host: server.server_host,
        ssh_port: server.ssh_port,
        username: server.username,
        password: '', // Password not stored in display
        api_port: server.api_port,
        virtual_mta: server.virtual_mta,
        job_pool: server.job_pool
      });

      if (result.success) {
        toast.success(`PowerMTA server "${server.name}" connection successful!`);
      } else {
        toast.error(`PowerMTA server "${server.name}" connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error(`PowerMTA server test failed: ${error.message}`);
    } finally {
      setTestingServerId(null);
    }
  };

  const handleToggleActive = async (server: PowerMTAServer) => {
    try {
      const { error } = await supabase
        .from('powermta_servers')
        .update({ is_active: !server.is_active })
        .eq('id', server.id);

      if (error) throw error;
      
      toast.success(`PowerMTA server ${!server.is_active ? 'activated' : 'deactivated'}`);
      loadServers();
    } catch (error) {
      toast.error('Failed to update PowerMTA server status');
      console.error('Error updating server status:', error);
    }
  };

  const handleDeleteServer = async (server: PowerMTAServer) => {
    if (!confirm(`Are you sure you want to delete PowerMTA server "${server.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('powermta_servers')
        .delete()
        .eq('id', server.id);

      if (error) throw error;
      
      toast.success('PowerMTA server deleted successfully');
      loadServers();
    } catch (error) {
      toast.error('Failed to delete PowerMTA server');
      console.error('Error deleting server:', error);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-600">Please select an organization to manage PowerMTA servers.</p>
      </div>
    );
  }

  if (showAddForm || editingServer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingServer ? 'Edit PowerMTA Server' : 'Add PowerMTA Server'}
          </h3>
          <Button
            variant="outline"
            onClick={() => {
              setShowAddForm(false);
              setEditingServer(null);
            }}
          >
            Cancel
          </Button>
        </div>
        
        <PowerMTAConfigForm
          onSave={handleSaveServer}
          initialConfig={editingServer ? {
            name: editingServer.name,
            server_host: editingServer.server_host,
            ssh_port: editingServer.ssh_port,
            username: editingServer.username,
            password: '',
            api_port: editingServer.api_port,
            virtual_mta: editingServer.virtual_mta,
            job_pool: editingServer.job_pool
          } : undefined}
          isEditing={!!editingServer}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PowerMTA Servers</h3>
          <p className="text-sm text-gray-600">
            Manage PowerMTA servers for campaign distribution bridge
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
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

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-600">Loading PowerMTA servers...</div>
        </div>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-32">
            <Server className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-gray-600">No PowerMTA servers configured</p>
            <Button className="mt-2" onClick={() => setShowAddForm(true)}>
              Add Your First PowerMTA Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <Card key={server.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center">
                    <Server className="w-4 h-4 mr-2" />
                    {server.name}
                    <Badge 
                      variant={server.is_active ? "default" : "secondary"}
                      className="ml-2"
                    >
                      {server.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestServer(server)}
                      disabled={testingServerId === server.id}
                    >
                      <TestTube className="w-3 h-3 mr-1" />
                      {testingServerId === server.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingServer(server)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteServer(server)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Host:</span>
                    <br />
                    {server.server_host}:{server.ssh_port}
                  </div>
                  <div>
                    <span className="font-medium">User:</span>
                    <br />
                    {server.username}
                  </div>
                  <div>
                    <span className="font-medium">Virtual MTA:</span>
                    <br />
                    {server.virtual_mta}
                  </div>
                  <div>
                    <span className="font-medium">Job Pool:</span>
                    <br />
                    {server.job_pool}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Button
                    size="sm"
                    variant={server.is_active ? "secondary" : "default"}
                    onClick={() => handleToggleActive(server)}
                  >
                    {server.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PowerMTAServerManager;
