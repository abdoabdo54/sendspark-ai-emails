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
      
      // First check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id, 'Error:', userError);
      
      // Check user roles for this organization
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user?.id)
        .eq('organization_id', organizationId);
      
      console.log('User roles for org:', userRoles, 'Error:', rolesError);
      
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      console.log('Email accounts query result:', { data, error });

      if (error) {
        console.error('Supabase error fetching accounts:', error);
        toast({
          title: "Error",
          description: `Failed to load email accounts: ${error.message}`,
          variant: "destructive"
        });
        return;
      }
      
      console.log('Raw fetched accounts data:', data);
      
      const typedData = (data || []).map(item => {
        // Ensure config is always an object
        const baseConfig = item.config && typeof item.config === 'object' ? item.config : {};
        
        return {
          ...item,
          type: item.type as 'apps-script' | 'powermta' | 'smtp',
          // Remove rate limiting from config to use campaign-level controls
          config: {
            ...baseConfig,
            // Remove these rate limiting fields if they exist
            emails_per_hour: undefined,
            emails_per_second: undefined,
            delay_in_seconds: undefined,
            rate_limit_enabled: false
          }
        };
      }) as EmailAccount[];
      
      console.log('Processed accounts data (rate limits removed):', typedData);
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
      
      // Ensure config is always an object and remove rate limiting fields
      const baseConfig = accountData.config && typeof accountData.config === 'object' ? accountData.config : {};
      
      const accountToCreate = {
        name: accountData.name,
        type: accountData.type,
        email: accountData.email,
        is_active: accountData.is_active,
        // Remove rate limiting from account config - will use campaign-level controls
        config: {
          ...baseConfig,
          // Ensure no rate limiting fields are saved at account level
          emails_per_hour: undefined,
          emails_per_second: undefined,
          delay_in_seconds: undefined,
          rate_limit_enabled: false,
          note: "Rate limits controlled at campaign level for optimal performance"
        },
        organization_id: organizationId
      };

      console.log('Account payload to create (no rate limits):', accountToCreate);

      const { data, error } = await supabase
        .from('email_accounts')
        .insert([accountToCreate])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating account:', error);
        toast({
          title: "Error",
          description: `Failed to add email account: ${error.message}`,
          variant: "destructive"
        });
        throw error;
      }

      console.log('Account created successfully:', data);

      const typedData = {
        ...data,
        type: data.type as 'apps-script' | 'powermta' | 'smtp',
        config: data.config || {}
      } as EmailAccount;

      setAccounts(prev => [typedData, ...prev]);
      
      toast({
        title: "Success",
        description: `${accountData.name} has been added successfully. Rate limits will be controlled at campaign level for optimal performance.`
      });
      
      return typedData;
    } catch (error) {
      console.error('Error adding account:', error);
      throw error;
    }
  };

  const updateAccount = async (id: string, updates: Partial<EmailAccount>) => {
    try {
      // Ensure config is always an object and remove rate limiting fields
      const baseConfig = updates.config && typeof updates.config === 'object' ? updates.config : {};
      
      const cleanUpdates = {
        ...updates,
        config: {
          ...baseConfig,
          // Remove rate limiting fields
          emails_per_hour: undefined,
          emails_per_second: undefined,
          delay_in_seconds: undefined,
          rate_limit_enabled: false
        },
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('email_accounts')
        .update(cleanUpdates)
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
        description: "Email account updated successfully. Rate limits are now controlled at campaign level."
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
