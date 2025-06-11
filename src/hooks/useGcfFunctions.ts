
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface GcfFunction {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_used?: string;
  region?: string;
  notes?: string;
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

      if (error) {
        console.error('Error fetching GCF functions:', error);
        toast({
          title: "Error",
          description: "Failed to load Cloud Functions",
          variant: "destructive"
        });
        return;
      }
      
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

  const createFunction = async (functionData: Omit<GcfFunction, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
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
          organization_id: organizationId
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating GCF function:', error);
        toast({
          title: "Error",
          description: `Failed to add Cloud Function: ${error.message}`,
          variant: "destructive"
        });
        return null;
      }

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

  const updateFunction = async (functionId: string, updates: Partial<GcfFunction>) => {
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

  useEffect(() => {
    fetchFunctions();
  }, [organizationId]);

  return {
    functions,
    loading,
    createFunction,
    updateFunction,
    deleteFunction,
    refetch: fetchFunctions
  };
};
