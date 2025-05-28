
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Subscriber {
  id: string;
  organization_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  custom_fields: any;
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained';
  tags: string[];
  source?: string;
  subscribed_at?: string;
  unsubscribed_at?: string;
  created_at: string;
  updated_at: string;
}

export const useSubscribers = (organizationId?: string) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        status: item.status as 'active' | 'unsubscribed' | 'bounced' | 'complained'
      })) as Subscriber[];
      
      setSubscribers(typedData);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast({
        title: "Error",
        description: "Failed to load subscribers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addSubscriber = async (subscriberData: Omit<Subscriber, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('subscribers')
        .insert([{
          ...subscriberData,
          organization_id: organizationId
        }])
        .select()
        .single();

      if (error) throw error;

      const typedData = {
        ...data,
        status: data.status as 'active' | 'unsubscribed' | 'bounced' | 'complained'
      } as Subscriber;

      setSubscribers(prev => [typedData, ...prev]);
      toast({
        title: "Success",
        description: "Subscriber added successfully"
      });
      return typedData;
    } catch (error) {
      console.error('Error adding subscriber:', error);
      toast({
        title: "Error",
        description: "Failed to add subscriber",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateSubscriber = async (id: string, updates: Partial<Subscriber>) => {
    try {
      const { data, error } = await supabase
        .from('subscribers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const typedData = {
        ...data,
        status: data.status as 'active' | 'unsubscribed' | 'bounced' | 'complained'
      } as Subscriber;

      setSubscribers(prev => prev.map(s => s.id === id ? typedData : s));
      toast({
        title: "Success",
        description: "Subscriber updated successfully"
      });
    } catch (error) {
      console.error('Error updating subscriber:', error);
      toast({
        title: "Error",
        description: "Failed to update subscriber",
        variant: "destructive"
      });
    }
  };

  const deleteSubscriber = async (id: string) => {
    try {
      const { error } = await supabase
        .from('subscribers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSubscribers(prev => prev.filter(s => s.id !== id));
      toast({
        title: "Success",
        description: "Subscriber deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting subscriber:', error);
      toast({
        title: "Error",
        description: "Failed to delete subscriber",
        variant: "destructive"
      });
    }
  };

  const importSubscribers = async (csvData: string) => {
    if (!organizationId) return;

    try {
      // Parse CSV data (simple implementation)
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const firstNameIndex = headers.findIndex(h => h.includes('first') || h.includes('name'));
      const lastNameIndex = headers.findIndex(h => h.includes('last') || h.includes('surname'));
      
      if (emailIndex === -1) {
        throw new Error('Email column not found in CSV');
      }

      const subscribersToImport = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const email = values[emailIndex];
        
        if (email) {
          subscribersToImport.push({
            email,
            first_name: firstNameIndex !== -1 ? values[firstNameIndex] : undefined,
            last_name: lastNameIndex !== -1 ? values[lastNameIndex] : undefined,
            organization_id: organizationId,
            status: 'active' as const,
            tags: [],
            custom_fields: {},
            source: 'csv_import'
          });
        }
      }

      const { data, error } = await supabase
        .from('subscribers')
        .upsert(subscribersToImport, { 
          onConflict: 'organization_id,email',
          ignoreDuplicates: true 
        })
        .select();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Imported ${data?.length || 0} subscribers successfully`
      });

      fetchSubscribers();
    } catch (error) {
      console.error('Error importing subscribers:', error);
      toast({
        title: "Error",
        description: "Failed to import subscribers",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchSubscribers();
    }
  }, [organizationId]);

  return {
    subscribers,
    loading,
    addSubscriber,
    updateSubscriber,
    deleteSubscriber,
    importSubscribers,
    refetch: fetchSubscribers
  };
};
