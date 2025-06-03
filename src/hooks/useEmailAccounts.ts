
import { useState, useEffect } from 'react';
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

// Mock data for demo mode
const mockAccounts: EmailAccount[] = [
  {
    id: 'demo-smtp-1',
    name: 'Demo SMTP Account',
    type: 'smtp',
    email: 'demo@example.com',
    is_active: true,
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      username: 'demo@example.com',
      password: '****',
      encryption: 'tls',
      auth_required: true
    },
    organization_id: 'demo-org',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const useEmailAccounts = (organizationId?: string) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>(mockAccounts);
  const [loading, setLoading] = useState(false);

  const addAccount = async (accountData: Omit<EmailAccount, 'id' | 'created_at' | 'updated_at' | 'organization_id'>) => {
    try {
      const newAccount: EmailAccount = {
        ...accountData,
        id: `demo-${Date.now()}`,
        organization_id: organizationId || 'demo-org',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setAccounts(prev => [newAccount, ...prev]);
      toast({
        title: "Success",
        description: `${accountData.name} has been added successfully`
      });
      return newAccount;
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
      const updatedAccount = accounts.find(acc => acc.id === id);
      if (!updatedAccount) throw new Error('Account not found');

      const newAccount = { ...updatedAccount, ...updates, updated_at: new Date().toISOString() };
      setAccounts(prev => prev.map(account => 
        account.id === id ? newAccount : account
      ));
      return newAccount;
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

  const fetchAccounts = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    fetchAccounts();
  }, [organizationId]);

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts
  };
};
