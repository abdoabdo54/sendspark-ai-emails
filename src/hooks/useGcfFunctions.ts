
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface GcfFunction {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const useGcfFunctions = (organizationId?: string) => {
  const [functions, setFunctions] = useState<GcfFunction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunctions = async () => {
    if (!organizationId) {
      setFunctions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('gcf_functions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setFunctions(data || []);
    } catch (error) {
      console.error('Error fetching GCF functions:', error);
      toast({
        title: "Error",
        description: "Failed to load Cloud Functions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFunction = async (functionData: { name: string; url: string; enabled?: boolean }) => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('gcf_functions')
        .insert([{
          ...functionData,
          organization_id: organizationId,
          enabled: functionData.enabled ?? true
        }])
        .select()
        .single();

      if (error) throw error;

      setFunctions(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Cloud Function added successfully"
      });
      
      return data;
    } catch (error: any) {
      console.error('Error creating GCF function:', error);
      toast({
        title: "Error",
        description: `Failed to add Cloud Function: ${error.message}`,
        variant: "destructive"
      });
      return null;
    }
  };

  const updateFunction = async (functionId: string, updates: Partial<Pick<GcfFunction, 'name' | 'url' | 'enabled'>>) => {
    try {
      const { data, error } = await supabase
        .from('gcf_functions')
        .update(updates)
        .eq('id', functionId)
        .select()
        .single();

      if (error) throw error;

      setFunctions(prev => prev.map(func => 
        func.id === functionId ? data : func
      ));

      return data;
    } catch (error) {
      console.error('Error updating GCF function:', error);
      toast({
        title: "Error",
        description: "Failed to update Cloud Function",
        variant: "destructive"
      });
      return null;
    }
  };

  const deleteFunction = async (functionId: string) => {
    try {
      const { error } = await supabase
        .from('gcf_functions')
        .delete()
        .eq('id', functionId);

      if (error) throw error;

      setFunctions(prev => prev.filter(func => func.id !== functionId));
      toast({
        title: "Success",
        description: "Cloud Function deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting GCF function:', error);
      toast({
        title: "Error",
        description: "Failed to delete Cloud Function",
        variant: "destructive"
      });
    }
  };

  const testFunction = async (url: string, name: string) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, ping: 'health-check' })
      });
      
      if (response.ok) {
        toast({
          title: "✅ Health Check Passed",
          description: `${name} is responding correctly`,
        });
        return true;
      } else {
        toast({
          title: "❌ Health Check Failed",
          description: `${name} returned status ${response.status}`,
          variant: "destructive"
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "❌ Health Check Failed",
        description: `Cannot reach ${name}: ${error.message}`,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, [organizationId]);

  return {
    functions,
    loading,
    createFunction,
    updateFunction,
    deleteFunction,
    testFunction,
    refetch: fetchFunctions
  };
};
