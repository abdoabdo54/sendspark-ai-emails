
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PowerMTAServer {
  id: string;
  organization_id: string;
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const usePowerMTAServers = (organizationId?: string) => {
  const [servers, setServers] = useState<PowerMTAServer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServers = useCallback(async () => {
    if (!organizationId) {
      setServers([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('powermta_servers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching PowerMTA servers:', error);
        toast.error(`Failed to load PowerMTA servers: ${error.message}`);
        return;
      }

      setServers(data || []);
    } catch (error) {
      console.error('Error fetching PowerMTA servers:', error);
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const addServer = async (serverData: Omit<PowerMTAServer, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    if (!organizationId) {
      toast.error('Organization ID is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('powermta_servers')
        .insert([{ ...serverData, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;

      setServers(prev => [data, ...prev]);
      toast.success(`PowerMTA server ${serverData.name} has been added successfully`);
      return data;
    } catch (error) {
      console.error('Error adding PowerMTA server:', error);
      toast.error('Failed to add PowerMTA server');
      throw error;
    }
  };

  const updateServer = async (id: string, updates: Partial<PowerMTAServer>) => {
    try {
      const { data, error } = await supabase
        .from('powermta_servers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setServers(prev => prev.map(server => server.id === id ? data : server));
      toast.success('PowerMTA server updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating PowerMTA server:', error);
      toast.error('Failed to update PowerMTA server');
      throw error;
    }
  };

  const deleteServer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('powermta_servers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServers(prev => prev.filter(server => server.id !== id));
      toast.success('PowerMTA server has been deleted');
    } catch (error) {
      console.error('Error deleting PowerMTA server:', error);
      toast.error('Failed to delete PowerMTA server');
    }
  };

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    loading,
    addServer,
    updateServer,
    deleteServer,
    refetch: fetchServers
  };
};
