
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Users, Check, X } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface CompactAccountSelectorProps {
  selectedAccounts: string[];
  onAccountsChange: (accounts: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const CompactAccountSelector: React.FC<CompactAccountSelectorProps> = ({
  selectedAccounts,
  onAccountsChange,
  onSelectAll,
  onDeselectAll
}) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  const [isOpen, setIsOpen] = useState(false);

  const activeAccounts = accounts.filter(account => account.is_active);
  const selectedCount = selectedAccounts.length;

  const handleAccountToggle = (accountId: string) => {
    const newSelection = selectedAccounts.includes(accountId)
      ? selectedAccounts.filter(id => id !== accountId)
      : [...selectedAccounts, accountId];
    onAccountsChange(newSelection);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectAll();
  };

  const handleDeselectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeselectAll();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Email Accounts
          <Badge variant="secondary" className="text-xs">
            {selectedCount}/{activeAccounts.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              type="button"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {selectedCount === 0 
                  ? "Select accounts..." 
                  : `${selectedCount} account${selectedCount !== 1 ? 's' : ''} selected`
                }
              </span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleSelectAll}
                  type="button"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleDeselectAll}
                  type="button"
                >
                  <X className="w-3 h-3 mr-1" />
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {activeAccounts.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No active email accounts found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {activeAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => handleAccountToggle(account.id)}
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onChange={() => handleAccountToggle(account.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {account.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {account.email}
                        </div>
                        <Badge 
                          variant={account.type === 'smtp' ? 'default' : 'secondary'} 
                          className="text-xs mt-1"
                        >
                          {account.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
};

export default CompactAccountSelector;
