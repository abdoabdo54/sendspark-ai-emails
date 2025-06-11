
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
      console.log('No organization ID provided, clearing functions');
      setFunctions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching GCF functions for organization:', organizationId);
      
      const { data, error } = await supabase
        .from('gcf_functions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      console.log('GCF functions query result:', { data, error });

      if (error) {
        console.error('Error fetching GCF functions:', error);
        toast({
          title: "Error",
          description: "Failed to load Cloud Functions",
          variant: "destructive"
        });
        return;
      }
      
      const functionsData = data || [];
      console.log('Loaded GCF functions:', functionsData);
      setFunctions(functionsData);
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
      console.log('Creating GCF function:', functionData);
      
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
        throw error;
      }

      console.log('Created GCF function:', data);
      setFunctions(prev => [data, ...prev]);
      
      toast({
        title: "Success",
        description: "Cloud Function added successfully"
      });
      
      return data;
    } catch (error) {
      console.error('Error creating GCF function:', error);
      toast({
        title: "Error",
        description: "Failed to add Cloud Function",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateFunction = async (functionId: string, updates: Partial<GcfFunction>) => {
    try {
      console.log('Updating GCF function:', functionId, updates);
      
      const { data, error } = await supabase
        .from('gcf_functions')
        .update(updates)
        .eq('id', functionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating GCF function:', error);
        throw error;
      }

      console.log('Updated GCF function:', data);
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
      console.log('Deleting GCF function:', functionId);
      
      const { error } = await supabase
        .from('gcf_functions')
        .delete()
        .eq('id', functionId);

      if (error) {
        console.error('Error deleting GCF function:', error);
        throw error;
      }

      console.log('Deleted GCF function:', functionId);
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

  const updateLastUsed = async (functionId: string) => {
    try {
      console.log('Updating last_used for function:', functionId);
      
      await supabase
        .from('gcf_functions')
        .update({ last_used: new Date().toISOString() })
        .eq('id', functionId);
    } catch (error) {
      console.error('Error updating last_used timestamp:', error);
    }
  };

  useEffect(() => {
    if (organizationId) {
      console.log('Organization changed, fetching functions for:', organizationId);
      fetchFunctions();
    } else {
      console.log('No organization, clearing functions');
      setFunctions([]);
      setLoading(false);
    }
  }, [organizationId]);

  return {
    functions,
    loading,
    createFunction,
    updateFunction,
    deleteFunction,
    updateLastUsed,
    refetch: fetchFunctions
  };
};
