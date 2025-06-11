
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface AccountSelectorProps {
  selectedAccounts: string[];
  onAccountsChange: (accountIds: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const AccountSelector = ({ selectedAccounts, onAccountsChange, onSelectAll, onDeselectAll }: AccountSelectorProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading } = useEmailAccounts(currentOrganization?.id);

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      onAccountsChange(selectedAccounts.filter(id => id !== accountId));
    } else {
      onAccountsChange([...selectedAccounts, accountId]);
    }
  };

  const activeAccounts = accounts.filter(account => account.is_active);
  const allSelected = selectedAccounts.length === activeAccounts.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading accounts...</div>
        </CardContent>
      </Card>
    );
  }

  if (activeAccounts.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            No Email Accounts Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700 text-sm">
            Please add and activate email accounts in Settings before launching campaigns.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Email Accounts ({selectedAccounts.length}/{activeAccounts.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={allSelected ? onDeselectAll : onSelectAll}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAccounts.map((account) => (
          <div 
            key={account.id} 
            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
          >
            <Checkbox
              checked={selectedAccounts.includes(account.id)}
              onCheckedChange={() => handleAccountToggle(account.id)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{account.name}</span>
                <Badge variant="outline">{account.type}</Badge>
                {account.is_active && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <p className="text-sm text-gray-600">{account.email}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AccountSelector;
