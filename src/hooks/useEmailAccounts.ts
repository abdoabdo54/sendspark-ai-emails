
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EmailAccount {
  id: string;
  name: string;
  type: 'apps-script' | 'powermta' | 'smtp';
  email: string;
  is_active: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

export const useEmailAccounts = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type cast the data to ensure proper typing
      const typedData = (data || []).map(item => ({
        ...item,
        type: item.type as 'apps-script' | 'powermta' | 'smtp'
      })) as EmailAccount[];
      
      setAccounts(typedData);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load email accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async (accountData: Omit<EmailAccount, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .insert([accountData])
        .select()
        .single();

      if (error) throw error;

      // Type cast the returned data
      const typedData = {
        ...data,
        type: data.type as 'apps-script' | 'powermta' | 'smtp'
      } as EmailAccount;

      setAccounts(prev => [typedData, ...prev]);
      toast({
        title: "Success",
        description: `${accountData.name} has been added successfully`
      });
      return typedData;
    } catch (error) {
      console.error('Error adding account:', error);
      toast({
        title: "Error",
        description: "Failed to add email account",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateAccount = async (id: string, updates: Partial<EmailAccount>) => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Type cast the returned data
      const typedData = {
        ...data,
        type: data.type as 'apps-script' | 'powermta' | 'smtp'
      } as EmailAccount;

      setAccounts(prev => prev.map(account => 
        account.id === id ? typedData : account
      ));
      return typedData;
    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        title: "Error",
        description: "Failed to update email account",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(prev => prev.filter(account => account.id !== id));
      toast({
        title: "Success",
        description: "Email account has been deleted"
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete email account",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts
  };
};
