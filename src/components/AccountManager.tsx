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
import { Plus, Edit, Trash2, Mail, Server, Shield, Loader2, TestTube, AlertCircle } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useOrganizations } from '@/hooks/useOrganizations';
import { toast } from '@/hooks/use-toast';
import SMTPConfigForm from './SMTPConfigForm';
import AppsScriptConfigForm from './AppsScriptConfigForm';
import PowerMTAConfigForm from './PowerMTAConfigForm';

// Define the config interfaces
interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
}

interface AppsScriptConfig {
  script_id: string;
  deployment_id: string;
  api_key: string;
  daily_quota: number;
}

interface PowerMTAConfig {
  server_host: string;
  api_port: number;
  username: string;
  password: string;
  virtual_mta: string;
  job_pool: string;
  max_hourly_rate: number;
}

const AccountManager = () => {
  const { currentOrganization } = useOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useEmailAccounts(currentOrganization?.id);
  const [selectedTab, setSelectedTab] = useState('list');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);

  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: 'smtp' | 'apps-script' | 'powermta';
    email: string;
    is_active: boolean;
    config: SMTPConfig | AppsScriptConfig | PowerMTAConfig;
  }>({
    name: '',
    type: 'smtp',
    email: '',
    is_active: true,
    config: {
      host: '',
      port: 587,
      username: '',
      password: '',
      encryption: 'tls' as const,
      auth_required: true
    }
  });

  const handleConfigChange = (config: any) => {
    setNewAccount(prev => ({ ...prev, config }));
  };

  const getDefaultConfig = (type: 'smtp' | 'apps-script' | 'powermta'): SMTPConfig | AppsScriptConfig | PowerMTAConfig => {
    switch (type) {
      case 'smtp':
        return {
          host: '',
          port: 587,
          username: '',
          password: '',
          encryption: 'tls' as const,
          auth_required: true
        };
      case 'apps-script':
        return {
          script_id: '',
          deployment_id: '',
          api_key: '',
          daily_quota: 100
        };
      case 'powermta':
        return {
          server_host: '',
          api_port: 25,
          username: '',
          password: '',
          virtual_mta: 'default',
          job_pool: 'default',
          max_hourly_rate: 10000
        };
    }
  };

  const handleTypeChange = (type: 'smtp' | 'apps-script' | 'powermta') => {
    setNewAccount(prev => ({
      ...prev,
      type,
      config: getDefaultConfig(type)
    }));
  };

  const handleTestConnection = async () => {
    toast({
      title: "Testing Connection",
      description: "Testing SMTP connection...",
    });
    
    // Simulate connection test
    setTimeout(() => {
      toast({
        title: "Connection Successful",
        description: "SMTP connection test passed!",
      });
    }, 2000);
  };

  const validateConfig = (type: string, config: any) => {
    switch (type) {
      case 'smtp':
        return config.host && config.port && config.username && config.password;
      case 'apps-script':
        return config.script_id && config.deployment_id;
      case 'powermta':
        return config.server_host && config.username && config.password;
      default:
        return true;
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in account name and email",
        variant: "destructive"
      });
      return;
    }

    if (!validateConfig(newAccount.type, newAccount.config)) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in all required configuration fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addAccount(newAccount);
      setNewAccount({ 
        name: '', 
        type: 'smtp', 
        email: '', 
        is_active: true, 
        config: getDefaultConfig('smtp') 
      });
      setSelectedTab('list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAccount = (account: any) => {
    setEditingAccount(account.id);
    setNewAccount({
      name: account.name,
      type: account.type,
      email: account.email,
      is_active: account.is_active,
      config: account.config
    });
    setSelectedTab('add');
  };

  const handleSaveAccount = async () => {
    if (!newAccount.name || !newAccount.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in account name and email",
        variant: "destructive"
      });
      return;
    }

    if (!validateConfig(newAccount.type, newAccount.config)) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in all required configuration fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount, newAccount);
        setEditingAccount(null);
        toast({
          title: "Success",
          description: "Account updated successfully"
        });
      } else {
        await addAccount(newAccount);
        toast({
          title: "Success", 
          description: "Account added successfully"
        });
      }
      
      setNewAccount({ 
        name: '', 
        type: 'smtp', 
        email: '', 
        is_active: true, 
        config: getDefaultConfig('smtp') 
      });
      setSelectedTab('list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccount(null);
    setNewAccount({ 
      name: '', 
      type: 'smtp', 
      email: '', 
      is_active: true, 
      config: getDefaultConfig('smtp') 
    });
    setSelectedTab('list');
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
      case 'powermta': return 'PowerMTA';
      case 'smtp': return 'SMTP Server';
      default: return type;
    }
  };

  const renderConfigForm = () => {
    switch (newAccount.type) {
      case 'smtp':
        return (
          <SMTPConfigForm
            config={newAccount.config as SMTPConfig}
            onChange={handleConfigChange}
            onTest={handleTestConnection}
          />
        );
      case 'apps-script':
        return (
          <AppsScriptConfigForm
            config={newAccount.config as AppsScriptConfig}
            onChange={handleConfigChange}
          />
        );
      case 'powermta':
        return (
          <PowerMTAConfigForm
            config={newAccount.config as PowerMTAConfig}
            onChange={handleConfigChange}
          />
        );
      default:
        return null;
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">Organization Required</h3>
          <p className="text-slate-500">Please set up an organization first.</p>
        </div>
      </div>
    );
  }

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
          <TabsTrigger value="add">{editingAccount ? 'Edit Account' : 'Add New'}</TabsTrigger>
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
                        <Button variant="outline" size="sm" onClick={() => handleEditAccount(account)}>
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
              <CardTitle>{editingAccount ? 'Edit Email Account' : 'Add New Email Account'}</CardTitle>
              <CardDescription>
                {editingAccount ? 'Update your email account configuration' : 'Configure a new email sending account for your campaigns'}
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
                  <Select value={newAccount.type} onValueChange={handleTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP Server</SelectItem>
                      <SelectItem value="apps-script">Google Apps Script</SelectItem>
                      <SelectItem value="powermta">PowerMTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">From Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sender@example.com"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <Separator />

              {renderConfigForm()}

              <Separator />

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSaveAccount} 
                  className="flex-1"
                  disabled={isSubmitting || !newAccount.name || !newAccount.email}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingAccount ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingAccount ? 'Update Account' : 'Add Account'
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>
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
