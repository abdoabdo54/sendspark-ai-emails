
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';

interface CompactAccountSelectorProps {
  selectedAccounts: string[];
  onAccountsChange: (accountIds: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const CompactAccountSelector = ({ selectedAccounts, onAccountsChange, onSelectAll, onDeselectAll }: CompactAccountSelectorProps) => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading } = useEmailAccounts(currentOrganization?.id);
  const [manualSelection, setManualSelection] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeAccounts = accounts.filter(account => account.is_active);
  const allSelected = selectedAccounts.length === activeAccounts.length && activeAccounts.length > 0;

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      onAccountsChange(selectedAccounts.filter(id => id !== accountId));
    } else {
      onAccountsChange([...selectedAccounts, accountId]);
    }
  };

  const handleManualToggle = (enabled: boolean) => {
    setManualSelection(enabled);
    if (!enabled) {
      // Auto-select all when manual selection is disabled
      onSelectAll();
    }
  };

  const handleSelectAll = () => {
    onSelectAll();
    setDialogOpen(false);
  };

  const handleDeselectAll = () => {
    onDeselectAll();
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">Loading accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeAccounts.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">No active email accounts</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Email Accounts
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {selectedAccounts.length}/{activeAccounts.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Manual Selection Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="manual-selection" className="text-sm">Manual Selection</Label>
          <Switch
            id="manual-selection"
            checked={manualSelection}
            onCheckedChange={handleManualToggle}
          />
        </div>

        {/* Account Summary */}
        <div className="text-xs text-gray-600">
          {manualSelection ? (
            <span>{selectedAccounts.length} of {activeAccounts.length} accounts selected</span>
          ) : (
            <span>All {activeAccounts.length} accounts auto-selected</span>
          )}
        </div>

        {/* Manual Selection Dialog */}
        {manualSelection && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Settings className="w-3 h-3 mr-1" />
                Configure Selection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select Email Accounts
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {activeAccounts.map((account) => (
                    <div 
                      key={account.id} 
                      className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => handleAccountToggle(account.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{account.name}</span>
                          <Badge variant="outline" className="text-xs">{account.type}</Badge>
                          <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-gray-600 truncate">{account.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactAccountSelector;
