
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
  subscribed_at: string;
  unsubscribed_at?: string;
  created_at: string;
  updated_at: string;
}

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

export const useSubscribers = (organizationId?: string) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
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
      setSubscribers(data || []);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast({
        title: "Error",
        description: "Failed to load subscribers",
        variant: "destructive"
      });
    }
  };

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
      console.error('Error fetching lists:', error);
      toast({
        title: "Error",
        description: "Failed to load email lists",
        variant: "destructive"
      });
    }
  };

  const addSubscriber = async (subscriberData: Omit<Subscriber, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
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

      setSubscribers(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Subscriber added successfully"
      });
      return data;
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

  const createList = async (listData: Omit<EmailList, 'id' | 'organization_id' | 'subscriber_count' | 'created_at' | 'updated_at'>) => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('email_lists')
        .insert([{
          ...listData,
          organization_id: organizationId
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
      console.error('Error creating list:', error);
      toast({
        title: "Error",
        description: "Failed to create email list",
        variant: "destructive"
      });
      throw error;
    }
  };

  const importSubscribers = async (csvData: string, listId?: string) => {
    // Parse CSV and add subscribers
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const subscribers = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === headers.length && values[0]) {
        const subscriber: any = {
          email: values[0],
          status: 'active',
          tags: [],
          custom_fields: {}
        };

        // Map additional fields
        for (let j = 1; j < headers.length; j++) {
          const header = headers[j].toLowerCase();
          if (header.includes('first') && header.includes('name')) {
            subscriber.first_name = values[j];
          } else if (header.includes('last') && header.includes('name')) {
            subscriber.last_name = values[j];
          } else if (header.includes('phone')) {
            subscriber.phone = values[j];
          } else if (values[j]) {
            subscriber.custom_fields[headers[j]] = values[j];
          }
        }

        subscribers.push(subscriber);
      }
    }

    try {
      const { data, error } = await supabase
        .from('subscribers')
        .upsert(
          subscribers.map(s => ({
            ...s,
            organization_id: organizationId
          })),
          { onConflict: 'organization_id,email' }
        )
        .select();

      if (error) throw error;

      // Add to list if specified
      if (listId && data) {
        const listSubscribers = data.map(subscriber => ({
          list_id: listId,
          subscriber_id: subscriber.id
        }));

        await supabase
          .from('list_subscribers')
          .upsert(listSubscribers, { onConflict: 'list_id,subscriber_id' });
      }

      fetchSubscribers();
      toast({
        title: "Success",
        description: `Imported ${data?.length || 0} subscribers`
      });
      
      return data;
    } catch (error) {
      console.error('Error importing subscribers:', error);
      toast({
        title: "Error",
        description: "Failed to import subscribers",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    if (organizationId) {
      setLoading(true);
      Promise.all([fetchSubscribers(), fetchLists()]).finally(() => {
        setLoading(false);
      });
    }
  }, [organizationId]);

  return {
    subscribers,
    lists,
    loading,
    addSubscriber,
    createList,
    importSubscribers,
    refetch: () => Promise.all([fetchSubscribers(), fetchLists()])
  };
};
