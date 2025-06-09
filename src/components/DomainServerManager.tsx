
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
import { Globe, Server, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
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
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
    }
  };

  const fetchServers = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const addDomain = async () => {
    if (!currentOrganization?.id || !newDomain.trim()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('domains')
        .insert([{
          organization_id: currentOrganization.id,
          domain_name: newDomain.trim(),
          is_verified: false,
          dns_records: {}
        }])
        .select()
        .single();

      if (error) throw error;

      setDomains(prev => [data, ...prev]);
      setNewDomain('');
      
      toast({
        title: "Success",
        description: "Domain added successfully"
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

  const addServer = async () => {
    if (!currentOrganization?.id || !newServer.name.trim() || !newServer.ip.trim()) return;

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
            root_password: newServer.rootPassword // In production, this should be encrypted
          }
        }])
        .select()
        .single();

      if (error) throw error;

      setServers(prev => [data, ...prev]);
      setNewServer({ name: '', ip: '', port: 22, rootPassword: '' });
      
      toast({
        title: "Success",
        description: "Server added successfully"
      });
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

  const deleteDomain = async (domainId: string) => {
    try {
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
    }
  };

  const deleteServer = async (serverId: string) => {
    try {
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
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Domain & Server Management</DialogTitle>
          <DialogDescription>
            Manage your custom domains and tracking servers for enhanced email delivery.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="domains" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Domains
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Servers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domains" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add New Domain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="yourdomain.com"
                    className="flex-1"
                  />
                  <Button onClick={addDomain} disabled={loading || !newDomain.trim()}>
                    Add Domain
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {domains.map((domain) => (
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
              ))}
            </div>
          </TabsContent>

          <TabsContent value="servers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add New Server
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
                      placeholder="Email Server 1"
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
                    <Label htmlFor="server-port">Port</Label>
                    <Input
                      id="server-port"
                      type="number"
                      value={newServer.port}
                      onChange={(e) => setNewServer(prev => ({ ...prev, port: parseInt(e.target.value) }))}
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
                      placeholder="Enter root password"
                    />
                  </div>
                </div>
                <Button 
                  onClick={addServer} 
                  disabled={loading || !newServer.name.trim() || !newServer.ip.trim()}
                  className="w-full"
                >
                  Add Server
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {servers.map((server) => (
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
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
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
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default DomainServerManager;
