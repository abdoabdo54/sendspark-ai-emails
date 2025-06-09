
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Server, Plus, Trash2, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DomainServerManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Domain {
  id: string;
  domain_name: string;
  is_verified: boolean;
  dns_records: any;
  namecheap_config: any;
  created_at: string;
}

interface ServerConfig {
  id: string;
  server_name: string;
  ip_address: string;
  port: number;
  status: string;
  server_config: any;
  created_at: string;
}

const DomainServerManager: React.FC<DomainServerManagerProps> = ({ isOpen, onClose }) => {
  const { currentOrganization } = useSimpleOrganizations();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newDomain, setNewDomain] = useState('');
  const [namecheapApiKey, setNamecheapApiKey] = useState('');
  const [namecheapUsername, setNamecheapUsername] = useState('');
  const [newServer, setNewServer] = useState({
    name: '',
    ip: '',
    port: 22,
    rootPassword: ''
  });

  useEffect(() => {
    if (currentOrganization?.id && isOpen) {
      fetchDomains();
      fetchServers();
    }
  }, [currentOrganization?.id, isOpen]);

  const fetchDomains = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast({
        title: "Error",
        description: "Failed to fetch domains",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (error) {
      console.error('Error fetching servers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch servers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addDomainFromNamecheap = async () => {
    if (!currentOrganization?.id || !newDomain.trim() || !namecheapApiKey.trim() || !namecheapUsername.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all Namecheap credentials and domain name",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Insert domain with Namecheap config
      const { data, error } = await supabase
        .from('domains')
        .insert([{
          organization_id: currentOrganization.id,
          domain_name: newDomain.trim(),
          is_verified: false,
          dns_records: {},
          namecheap_config: {
            api_key: namecheapApiKey,
            username: namecheapUsername,
            sandbox: false // Set to true for testing
          }
        }])
        .select()
        .single();

      if (error) throw error;

      setDomains(prev => [data, ...prev]);
      setNewDomain('');
      setNamecheapApiKey('');
      setNamecheapUsername('');
      
      toast({
        title: "Success",
        description: "Domain added successfully. DNS configuration will be set up automatically."
      });

      // Trigger DNS setup in background
      setupDomainDNS(data.id, data.domain_name, {
        api_key: namecheapApiKey,
        username: namecheapUsername,
        sandbox: false
      });

    } catch (error) {
      console.error('Error adding domain:', error);
      toast({
        title: "Error",
        description: "Failed to add domain",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setupDomainDNS = async (domainId: string, domainName: string, namecheapConfig: any) => {
    try {
      // This would typically call a Supabase Edge Function to configure DNS
      // For now, we'll simulate the process
      const { error } = await supabase.functions.invoke('setup-domain-dns', {
        body: {
          domain_id: domainId,
          domain_name: domainName,
          namecheap_config: namecheapConfig,
          organization_id: currentOrganization?.id
        }
      });

      if (error) {
        console.error('DNS setup error:', error);
        return;
      }

      // Update domain status
      await supabase
        .from('domains')
        .update({ 
          is_verified: true,
          dns_records: {
            tracking_subdomain: `track.${domainName}`,
            unsubscribe_subdomain: `unsubscribe.${domainName}`,
            configured_at: new Date().toISOString()
          }
        })
        .eq('id', domainId);

      // Refresh domains list
      fetchDomains();

    } catch (error) {
      console.error('Error setting up DNS:', error);
    }
  };

  const addServer = async () => {
    if (!currentOrganization?.id || !newServer.name.trim() || !newServer.ip.trim()) {
      toast({
        title: "Error",
        description: "Please fill in server name and IP address",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('servers')
        .insert([{
          organization_id: currentOrganization.id,
          server_name: newServer.name.trim(),
          ip_address: newServer.ip.trim(),
          port: newServer.port,
          status: 'pending',
          server_config: {
            root_password: newServer.rootPassword,
            setup_status: 'pending',
            services: ['nginx', 'tracking', 'unsubscribe']
          }
        }])
        .select()
        .single();

      if (error) throw error;

      setServers(prev => [data, ...prev]);
      setNewServer({ name: '', ip: '', port: 22, rootPassword: '' });
      
      toast({
        title: "Success",
        description: "Server added successfully. Setup will begin automatically."
      });

      // Trigger server setup in background
      setupTrackingServer(data.id);

    } catch (error) {
      console.error('Error adding server:', error);
      toast({
        title: "Error",
        description: "Failed to add server",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setupTrackingServer = async (serverId: string) => {
    try {
      // This would call a Supabase Edge Function to set up the tracking server
      const { error } = await supabase.functions.invoke('setup-tracking-server', {
        body: {
          server_id: serverId,
          organization_id: currentOrganization?.id
        }
      });

      if (error) {
        console.error('Server setup error:', error);
        return;
      }

      // Update server status
      await supabase
        .from('servers')
        .update({ 
          status: 'active',
          server_config: {
            setup_status: 'completed',
            services: ['nginx', 'tracking', 'unsubscribe'],
            setup_completed_at: new Date().toISOString()
          }
        })
        .eq('id', serverId);

      // Refresh servers list
      fetchServers();

    } catch (error) {
      console.error('Error setting up server:', error);
    }
  };

  const deleteDomain = async (domainId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;

      setDomains(prev => prev.filter(d => d.id !== domainId));
      
      toast({
        title: "Success",
        description: "Domain deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast({
        title: "Error",
        description: "Failed to delete domain",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteServer = async (serverId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('servers')
        .delete()
        .eq('id', serverId);

      if (error) throw error;

      setServers(prev => prev.filter(s => s.id !== serverId));
      
      toast({
        title: "Success",
        description: "Server deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting server:', error);
      toast({
        title: "Error",
        description: "Failed to delete server",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Domain & Server Management</DialogTitle>
          <DialogDescription>
            Manage your custom domains via Namecheap API and set up tracking servers for enhanced email delivery.
            Supports automated DNS configuration and server provisioning.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="domains" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Domains ({domains.length})
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Servers ({servers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domains" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Domain from Namecheap
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="domain-name">Domain Name</Label>
                    <Input
                      id="domain-name"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="yourdomain.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="namecheap-username">Namecheap Username</Label>
                    <Input
                      id="namecheap-username"
                      value={namecheapUsername}
                      onChange={(e) => setNamecheapUsername(e.target.value)}
                      placeholder="your_namecheap_username"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="namecheap-api-key">Namecheap API Key</Label>
                  <Input
                    id="namecheap-api-key"
                    type="password"
                    value={namecheapApiKey}
                    onChange={(e) => setNamecheapApiKey(e.target.value)}
                    placeholder="your_namecheap_api_key"
                  />
                </div>
                <Button 
                  onClick={addDomainFromNamecheap} 
                  disabled={loading || !newDomain.trim() || !namecheapApiKey.trim() || !namecheapUsername.trim()}
                  className="w-full"
                >
                  {loading ? 'Adding Domain...' : 'Add Domain & Configure DNS'}
                </Button>
                <p className="text-sm text-gray-500">
                  This will automatically configure DNS records for email tracking, opens, clicks, and unsubscribes.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {loading && domains.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading domains...</p>
                  </CardContent>
                </Card>
              ) : domains.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No domains added yet. Add your first domain above.</p>
                  </CardContent>
                </Card>
              ) : (
                domains.map((domain) => (
                  <Card key={domain.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-blue-500" />
                          <div>
                            <h3 className="font-medium">{domain.domain_name}</h3>
                            <p className="text-sm text-gray-500">
                              Added on {new Date(domain.created_at).toLocaleDateString()}
                            </p>
                            {domain.dns_records?.tracking_subdomain && (
                              <p className="text-xs text-blue-600">
                                Tracking: {domain.dns_records.tracking_subdomain}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={domain.is_verified ? "default" : "secondary"}
                            className="flex items-center gap-1"
                          >
                            {domain.is_verified ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {domain.is_verified ? 'Verified' : 'Pending'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteDomain(domain.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="servers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Tracking Server
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      value={newServer.name}
                      onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Tracking Server 1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="server-ip">IP Address</Label>
                    <Input
                      id="server-ip"
                      value={newServer.ip}
                      onChange={(e) => setNewServer(prev => ({ ...prev, ip: e.target.value }))}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="server-port">SSH Port</Label>
                    <Input
                      id="server-port"
                      type="number"
                      value={newServer.port}
                      onChange={(e) => setNewServer(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                      placeholder="22"
                    />
                  </div>
                  <div>
                    <Label htmlFor="root-password">Root Password</Label>
                    <Input
                      id="root-password"
                      type="password"
                      value={newServer.rootPassword}
                      onChange={(e) => setNewServer(prev => ({ ...prev, rootPassword: e.target.value }))}
                      placeholder="Server root password"
                    />
                  </div>
                </div>
                <Button 
                  onClick={addServer} 
                  disabled={loading || !newServer.name.trim() || !newServer.ip.trim()}
                  className="w-full"
                >
                  {loading ? 'Adding Server...' : 'Add Server & Setup Tracking'}
                </Button>
                <p className="text-sm text-gray-500">
                  This will automatically install and configure Nginx, tracking endpoints, and unsubscribe handlers.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {loading && servers.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading servers...</p>
                  </CardContent>
                </Card>
              ) : servers.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No servers added yet. Add your first server above.</p>
                  </CardContent>
                </Card>
              ) : (
                servers.map((server) => (
                  <Card key={server.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-green-500" />
                          <div>
                            <h3 className="font-medium">{server.server_name}</h3>
                            <p className="text-sm text-gray-500">
                              {server.ip_address}:{server.port}
                            </p>
                            <p className="text-xs text-gray-400">
                              Added on {new Date(server.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={server.status === 'active' ? 'default' : 'secondary'}
                            className="flex items-center gap-1"
                          >
                            {server.status === 'active' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <Settings className="w-3 h-3 animate-spin" />
                            )}
                            {server.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteServer(server.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default DomainServerManager;
