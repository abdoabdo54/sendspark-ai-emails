
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EmailList {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  subscriber_count: number;
  tags: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const useEmailLists = (organizationId?: string) => {
  const [lists, setLists] = useState<EmailList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLists = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('email_lists')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setLists(data || []);
    } catch (error) {
      console.error('Error fetching email lists:', error);
      toast({
        title: "Error",
        description: "Failed to load email lists",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createList = async (listData: Omit<EmailList, 'id' | 'created_at' | 'updated_at' | 'organization_id' | 'subscriber_count'>) => {
    if (!organizationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('email_lists')
        .insert([{
          ...listData,
          organization_id: organizationId,
          created_by: user.id,
          subscriber_count: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setLists(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Email list created successfully"
      });
      return data;
    } catch (error) {
      console.error('Error creating email list:', error);
      toast({
        title: "Error",
        description: "Failed to create email list",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateList = async (id: string, updates: Partial<EmailList>) => {
    try {
      const { data, error } = await supabase
        .from('email_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setLists(prev => prev.map(list => list.id === id ? data : list));
      toast({
        title: "Success",
        description: "Email list updated successfully"
      });
    } catch (error) {
      console.error('Error updating email list:', error);
      toast({
        title: "Error",
        description: "Failed to update email list",
        variant: "destructive"
      });
    }
  };

  const deleteList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_lists')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setLists(prev => prev.filter(list => list.id !== id));
      toast({
        title: "Success",
        description: "Email list deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting email list:', error);
      toast({
        title: "Error",
        description: "Failed to delete email list",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchLists();
    }
  }, [organizationId]);

  return {
    lists,
    loading,
    createList,
    updateList,
    deleteList,
    refetch: fetchLists
  };
};
