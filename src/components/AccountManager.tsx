import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, RefreshCw, Mail, Server, Cloud } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';
import SMTPConfigForm from './SMTPConfigForm';
import AppsScriptConfigForm from './AppsScriptConfigForm';
import PowerMTAConfigForm from './PowerMTAConfigForm';

const AccountManager = () => {
  const { currentOrganization, loading: orgLoading } = useSimpleOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [activeTab, setActiveTab] = useState('list');
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const handleAddAccount = async (type: 'smtp' | 'apps-script' | 'powermta', name: string, email: string, config: any) => {
    try {
      await addAccount({
        name,
        email,
        type,
        is_active: true,
        config
      });
      setActiveTab('list');
      setEditingAccount(null);
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  const handleEditAccount = async (type: 'smtp' | 'apps-script' | 'powermta', name: string, email: string, config: any) => {
    if (!editingAccount) return;
    
    try {
      await updateAccount(editingAccount.id, {
        name,
        email,
        type,
        config
      });
      setActiveTab('list');
      setEditingAccount(null);
    } catch (error) {
      console.error('Error updating account:', error);
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setActiveTab(account.type);
  };

  const handleDelete = async (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(accountId);
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const handleCancel = () => {
    setActiveTab('list');
    setEditingAccount(null);
  };

  const handleTest = async (account: any) => {
    if (account.type === 'smtp') {
      await handleTestSMTP(account);
    } else if (account.type === 'apps-script') {
      await handleTestAppsScript(account);
    }
  };

  const handleTestSMTP = async (account: any) => {
    // Implement SMTP test logic here
  };

  const handleTestAppsScript = async (account: any) => {
    // Implement Apps Script test logic here
  };

  if (orgLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading organization...</div>
        </CardContent>
      </Card>
    );
  }

  if (!currentOrganization?.id) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-600">
            Please set up your organization first to manage email accounts.
          </div>
        </CardContent>
      </Card>
    );
  }

  const smtpAccounts = accounts.filter(acc => acc.type === 'smtp');
  const appsScriptAccounts = accounts.filter(acc => acc.type === 'apps-script');
  const powerMTAAccounts = accounts.filter(acc => acc.type === 'powermta');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Email Account Management
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('Refreshing accounts...');
                refetch();
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                All Accounts ({accounts.length})
              </TabsTrigger>
              <TabsTrigger value="smtp" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                SMTP ({smtpAccounts.length})
              </TabsTrigger>
              <TabsTrigger value="apps-script" className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Apps Script ({appsScriptAccounts.length})
              </TabsTrigger>
              <TabsTrigger value="powermta" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                PowerMTA ({powerMTAAccounts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p>Loading accounts...</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-2">No email accounts configured yet.</p>
                  <p className="text-sm">Add your first account using the tabs above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{account.name}</h3>
                          <p className="text-sm text-slate-600">{account.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="capitalize">
                              {account.type === 'apps-script' ? 'Apps Script' : account.type.toUpperCase()}
                            </Badge>
                            <Badge variant={account.is_active ? "default" : "secondary"}>
                              {account.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="smtp">
              <SMTPConfigForm
                onSubmit={(name, email, config) => handleAddAccount('smtp', name, email, config)}
                onCancel={handleCancel}
                initialData={editingAccount?.type === 'smtp' ? editingAccount : undefined}
              />
            </TabsContent>

            <TabsContent value="apps-script">
              <AppsScriptConfigForm
                onSubmit={(name, email, config) => handleAddAccount('apps-script', name, email, config)}
                onCancel={handleCancel}
                initialData={editingAccount?.type === 'apps-script' ? editingAccount : undefined}
              />
            </TabsContent>

            <TabsContent value="powermta">
              <PowerMTAConfigForm
                onSubmit={(name, email, config) => handleAddAccount('powermta', name, email, config)}
                onCancel={handleCancel}
                initialData={editingAccount?.type === 'powermta' ? editingAccount : undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountManager;
