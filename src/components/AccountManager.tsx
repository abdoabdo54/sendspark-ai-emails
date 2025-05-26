
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Mail, Server, Shield, Loader2 } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';

const AccountManager = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useEmailAccounts();
  const [selectedTab, setSelectedTab] = useState('list');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'apps-script' as const,
    email: '',
    is_active: true,
    config: {}
  });

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.email) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addAccount(newAccount);
      setNewAccount({ name: '', type: 'apps-script', email: '', is_active: true, config: {} });
      setSelectedTab('list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAccount = async (id: string, currentStatus: boolean) => {
    await updateAccount(id, { is_active: !currentStatus });
  };

  const handleDeleteAccount = async (id: string) => {
    await deleteAccount(id);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'apps-script': return <Mail className="w-4 h-4" />;
      case 'powermta': return <Server className="w-4 h-4" />;
      case 'smtp': return <Shield className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case 'apps-script': return 'Google Apps Script';
      case 'powermta': return 'PowerMTA SMTP';
      case 'smtp': return 'Generic SMTP';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Email Accounts</h2>
          <p className="text-slate-600">Manage your email sending accounts and configurations</p>
        </div>
        <Button onClick={() => setSelectedTab('add')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Account
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="list">Account List</TabsTrigger>
          <TabsTrigger value="add">Add New</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Mail className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No accounts configured</h3>
                <p className="text-slate-500 text-center mb-4">
                  Add your first email account to start sending campaigns
                </p>
                <Button onClick={() => setSelectedTab('add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card key={account.id} className={`transition-all duration-200 ${account.is_active ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {getAccountIcon(account.type)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{account.name}</CardTitle>
                          <CardDescription>{account.email}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={account.is_active ? 'default' : 'secondary'}>
                          {getAccountTypeName(account.type)}
                        </Badge>
                        <Switch
                          checked={account.is_active}
                          onCheckedChange={() => toggleAccount(account.id, account.is_active)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-slate-600">
                        Status: <span className={account.is_active ? 'text-green-600' : 'text-slate-500'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Email Account</CardTitle>
              <CardDescription>
                Configure a new email sending account for your campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., Primary Gmail, Company SMTP"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select 
                    value={newAccount.type} 
                    onValueChange={(value: any) => setNewAccount(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apps-script">Google Apps Script</SelectItem>
                      <SelectItem value="powermta">PowerMTA SMTP</SelectItem>
                      <SelectItem value="smtp">Generic SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sender@example.com"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <Separator />

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleAddAccount} 
                  className="flex-1"
                  disabled={isSubmitting || !newAccount.name || !newAccount.email}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Account'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setSelectedTab('list')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountManager;
