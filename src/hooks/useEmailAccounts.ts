
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

// Mock storage for demo mode
let mockAccounts: EmailAccount[] = [];

export const useEmailAccounts = (organizationId?: string) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      // In demo mode, use mock storage
      const filteredAccounts = mockAccounts.filter(account => account.organization_id === organizationId);
      setAccounts(filteredAccounts);
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
  };

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
      const newAccount: EmailAccount = {
        ...accountData,
        id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockAccounts.push(newAccount);
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
      const accountIndex = mockAccounts.findIndex(account => account.id === id);
      if (accountIndex === -1) {
        throw new Error('Account not found');
      }

      const updatedAccount = {
        ...mockAccounts[accountIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };

      mockAccounts[accountIndex] = updatedAccount;
      setAccounts(prev => prev.map(account => 
        account.id === id ? updatedAccount : account
      ));
      
      toast({
        title: "Success",
        description: "Email account updated successfully"
      });
      
      return updatedAccount;
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
      mockAccounts = mockAccounts.filter(account => account.id !== id);
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
    if (organizationId) {
      fetchAccounts();
    }
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
