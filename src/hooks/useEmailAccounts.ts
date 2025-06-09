import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EmailAccount {
  id: string;
  name: string;
  type: 'apps-script' | 'powermta' | 'smtp';
  email: string;
  is_active: boolean;
  config: any;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export const useEmailAccounts = (organizationId?: string) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!organizationId) {
      console.log('No organization ID provided for fetching accounts');
      setAccounts([]);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching accounts for organization:', organizationId);
      
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching accounts:', error);
        throw error;
      }
      
      console.log('Fetched accounts:', data);
      
      const typedData = (data || []).map(item => ({
        ...item,
        type: item.type as 'apps-script' | 'powermta' | 'smtp',
        config: item.config || {}
      })) as EmailAccount[];
      
      setAccounts(typedData);
    } catch (error) {
      console.error('Error fetching email accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load email accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const addAccount = async (accountData: Omit<EmailAccount, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Creating account with data:', accountData);
      console.log('Organization ID:', organizationId);
      
      // First, verify the organization exists
      const { data: orgCheck, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgCheck) {
        console.error('Organization not found:', orgError);
        toast({
          title: "Error",
          description: "Organization not found. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }

      const accountToCreate = {
        name: accountData.name,
        type: accountData.type,
        email: accountData.email,
        is_active: accountData.is_active,
        config: accountData.config || {},
        organization_id: organizationId
      };

      console.log('Account payload to create:', accountToCreate);

      const { data, error } = await supabase
        .from('email_accounts')
        .insert([accountToCreate])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating account:', error);
        throw error;
      }

      const typedData = {
        ...data,
        type: data.type as 'apps-script' | 'powermta' | 'smtp',
        config: data.config || {}
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
        description: `Failed to add email account: ${error.message}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateAccount = async (id: string, updates: Partial<EmailAccount>) => {
    try {
      const { data, error } = await supabase
        .from('email_accounts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const typedData = {
        ...data,
        type: data.type as 'apps-script' | 'powermta' | 'smtp',
        config: data.config || {}
      } as EmailAccount;

      setAccounts(prev => prev.map(account => 
        account.id === id ? typedData : account
      ));
      
      toast({
        title: "Success",
        description: "Email account updated successfully"
      });
      
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
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts
  };
};
