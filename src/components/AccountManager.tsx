
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
import { Plus, Edit, Trash2, Mail, Server, Shield } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface EmailAccount {
  id: string;
  name: string;
  type: 'apps-script' | 'powermta' | 'smtp';
  email: string;
  isActive: boolean;
  config: any;
}

const AccountManager = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([
    {
      id: '1',
      name: 'Primary Gmail',
      type: 'apps-script',
      email: 'primary@gmail.com',
      isActive: true,
      config: { scriptUrl: 'https://script.google.com/...' }
    },
    {
      id: '2',
      name: 'PowerMTA Server',
      type: 'powermta',
      email: 'smtp@company.com',
      isActive: true,
      config: { host: 'smtp.company.com', port: 25 }
    }
  ]);

  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'apps-script',
    email: '',
    config: {}
  });

  const [selectedTab, setSelectedTab] = useState('list');

  const addAccount = () => {
    if (!newAccount.name || !newAccount.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const account: EmailAccount = {
      id: Date.now().toString(),
      name: newAccount.name,
      type: newAccount.type as any,
      email: newAccount.email,
      isActive: true,
      config: newAccount.config
    };

    setAccounts(prev => [...prev, account]);
    setNewAccount({ name: '', type: 'apps-script', email: '', config: {} });
    setSelectedTab('list');

    toast({
      title: "Account Added",
      description: `${newAccount.name} has been added successfully`
    });
  };

  const toggleAccount = (id: string) => {
    setAccounts(prev => prev.map(account => 
      account.id === id ? { ...account, isActive: !account.isActive } : account
    ));
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(account => account.id !== id));
    toast({
      title: "Account Deleted",
      description: "Email account has been removed"
    });
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
                <Card key={account.id} className={`transition-all duration-200 ${account.isActive ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${account.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {getAccountIcon(account.type)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{account.name}</CardTitle>
                          <CardDescription>{account.email}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={account.isActive ? 'default' : 'secondary'}>
                          {getAccountTypeName(account.type)}
                        </Badge>
                        <Switch
                          checked={account.isActive}
                          onCheckedChange={() => toggleAccount(account.id)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-slate-600">
                        Status: <span className={account.isActive ? 'text-green-600' : 'text-slate-500'}>
                          {account.isActive ? 'Active' : 'Inactive'}
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
                          onClick={() => deleteAccount(account.id)}
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
                    onValueChange={(value) => setNewAccount(prev => ({ ...prev, type: value }))}
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

              {newAccount.type === 'apps-script' && (
                <div className="space-y-4">
                  <h4 className="font-medium">Google Apps Script Configuration</h4>
                  <div className="space-y-2">
                    <Label htmlFor="scriptUrl">Script Web App URL</Label>
                    <Input
                      id="scriptUrl"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      onChange={(e) => setNewAccount(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, scriptUrl: e.target.value } 
                      }))}
                    />
                  </div>
                </div>
              )}

              {newAccount.type === 'powermta' && (
                <div className="space-y-4">
                  <h4 className="font-medium">PowerMTA Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pmtaHost">SMTP Host</Label>
                      <Input
                        id="pmtaHost"
                        placeholder="smtp.company.com"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, host: e.target.value } 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pmtaPort">Port</Label>
                      <Input
                        id="pmtaPort"
                        placeholder="25"
                        type="number"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, port: parseInt(e.target.value) } 
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {newAccount.type === 'smtp' && (
                <div className="space-y-4">
                  <h4 className="font-medium">SMTP Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.gmail.com"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, host: e.target.value } 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">Port</Label>
                      <Input
                        id="smtpPort"
                        placeholder="587"
                        type="number"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, port: parseInt(e.target.value) } 
                        }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="your-email@gmail.com"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, username: e.target.value } 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="App password or regular password"
                        onChange={(e) => setNewAccount(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, password: e.target.value } 
                        }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateLimit">Rate Limit (emails per minute)</Label>
                    <Input
                      id="rateLimit"
                      placeholder="60"
                      type="number"
                      onChange={(e) => setNewAccount(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, rateLimit: parseInt(e.target.value) } 
                      }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={addAccount} className="flex-1">
                  Add Account
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
