
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePowerMTAServers } from '@/hooks/usePowerMTAServers';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import PowerMTAConfigForm from '@/components/PowerMTAConfigForm';
import { toast } from '@/hooks/use-toast';
import { 
  Server, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Terminal, 
  Globe,
  Shield,
  CheckCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';

const PowerMTAServers = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { servers, loading, addServer, updateServer, deleteServer, refetch } = usePowerMTAServers(currentOrganization?.id);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [webInterfaceUrl, setWebInterfaceUrl] = useState<string | null>(null);

  const filteredServers = servers.filter(server => 
    server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    server.server_host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddServer = async (name: string, email: string, config: any) => {
    try {
      await addServer({
        name,
        server_host: config.server_host,
        ssh_port: config.ssh_port,
        username: config.username,
        password: config.password,
        api_port: config.api_port,
        virtual_mta: config.virtual_mta,
        job_pool: config.job_pool,
        proxy_enabled: config.proxy_enabled || false,
        proxy_host: config.proxy_host,
        proxy_port: config.proxy_port,
        proxy_username: config.proxy_username,
        proxy_password: config.proxy_password,
        manual_overrides: config.manual_overrides || {},
        is_active: true
      });
      
      toast({
        title: "✅ Server Added",
        description: `PowerMTA server "${name}" has been added successfully`
      });
      
      setShowAddForm(false);
      refetch();
    } catch (error) {
      console.error('Error adding PowerMTA server:', error);
      toast({
        title: "Error",
        description: "Failed to add PowerMTA server",
        variant: "destructive"
      });
    }
  };

  const handleUpdateServer = async (name: string, email: string, config: any) => {
    if (!editingServer) return;
    
    try {
      await updateServer(editingServer.id, {
        name,
        server_host: config.server_host,
        ssh_port: config.ssh_port,
        username: config.username,
        password: config.password,
        api_port: config.api_port,
        virtual_mta: config.virtual_mta,
        job_pool: config.job_pool,
        proxy_enabled: config.proxy_enabled || false,
        proxy_host: config.proxy_host,
        proxy_port: config.proxy_port,
        proxy_username: config.proxy_username,
        proxy_password: config.proxy_password,
        manual_overrides: config.manual_overrides || {}
      });
      
      toast({
        title: "✅ Server Updated",
        description: `PowerMTA server "${name}" has been updated successfully`
      });
      
      setEditingServer(null);
      refetch();
    } catch (error) {
      console.error('Error updating PowerMTA server:', error);
      toast({
        title: "Error",
        description: "Failed to update PowerMTA server",
        variant: "destructive"
      });
    }
  };

  const handleDeleteServer = async (serverId: string, serverName: string) => {
    if (!confirm(`Are you sure you want to delete "${serverName}"?`)) return;
    
    try {
      await deleteServer(serverId);
      toast({
        title: "✅ Server Deleted",
        description: `PowerMTA server "${serverName}" has been deleted`
      });
      refetch();
    } catch (error) {
      console.error('Error deleting PowerMTA server:', error);
      toast({
        title: "Error",
        description: "Failed to delete PowerMTA server",
        variant: "destructive"
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "PowerMTA servers list has been refreshed"
    });
  };

  const handleWebInterface = (server: any) => {
    const url = `http://${server.server_host}:${server.api_port || 8080}`;
    setWebInterfaceUrl(url);
  };

  if (showAddForm || editingServer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <PowerMTAConfigForm
            onSubmit={editingServer ? handleUpdateServer : handleAddServer}
            onCancel={() => {
              setShowAddForm(false);
              setEditingServer(null);
            }}
            initialData={editingServer}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="w-8 h-8 text-blue-600" />
              PowerMTA Servers
            </h1>
            <p className="text-gray-600 mt-2">
              Manage your PowerMTA email servers and configurations
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add PowerMTA Server
            </Button>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search servers by name or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{servers.length}</div>
            <div className="text-sm text-gray-600">Total Servers</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {servers.filter(s => s.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active Servers</div>
          </div>
        </div>

        {/* Web Interface Preview */}
        {webInterfaceUrl && (
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  PowerMTA Web Interface
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(webInterfaceUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWebInterfaceUrl(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden" style={{ height: '500px' }}>
                <iframe
                  src={webInterfaceUrl}
                  className="w-full h-full"
                  title="PowerMTA Web Interface"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Servers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading PowerMTA servers...</p>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">
                {searchTerm ? 'No servers match your search' : 'No PowerMTA servers configured'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Server
                </Button>
              )}
            </div>
          ) : (
            filteredServers.map((server) => (
              <Card key={server.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      {server.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {server.is_active ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <Badge variant={server.is_active ? "default" : "secondary"}>
                        {server.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Host:</span>
                      <span className="font-mono">{server.server_host}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">SSH Port:</span>
                      <span className="font-mono">{server.ssh_port}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Username:</span>
                      <span className="font-mono">{server.username}</span>
                    </div>
                    
                    {server.api_port && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">API Port:</span>
                        <span className="font-mono">{server.api_port}</span>
                      </div>
                    )}
                    
                    {server.virtual_mta && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Virtual MTA:</span>
                        <span className="font-mono">{server.virtual_mta}</span>
                      </div>
                    )}
                  </div>

                  {/* Proxy Status */}
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-600">Proxy:</span>
                    <Badge variant="outline" className="text-xs">
                      {server.proxy_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {server.proxy_enabled && server.proxy_host && (
                      <span className="text-xs text-gray-500">
                        {server.proxy_host}:{server.proxy_port}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingServer(server)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWebInterfaceUrl(`http://${server.server_host}:${server.api_port || 8080}`)}
                      disabled={!server.api_port}
                      title="Open Web Interface"
                    >
                      <Globe className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${server.name}"?`)) {
                          deleteServer(server.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PowerMTAServers;
