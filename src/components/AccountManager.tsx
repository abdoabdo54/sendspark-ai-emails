import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, TestTube, Trash2, Edit, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEmailAccounts, EmailAccount } from '@/hooks/useEmailAccounts';
import AppsScriptConfigForm from '@/components/AppsScriptConfigForm';
import SMTPConfigForm from '@/components/SMTPConfigForm';
import PowerMTAConfigForm from '@/components/PowerMTAConfigForm';
import { useOrganizations } from '@/hooks/useOrganizations';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';
import { sendEmailViaSMTP, testSMTPConnection } from '@/utils/emailSender';

// Standardized interfaces to match component requirements
interface AppsScriptConfig {
  exec_url: string;
  script_id: string;
  deployment_id: string;
  daily_quota: number;
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
}

interface PowerMTAConfig {
  server_host: string;
  api_port: number;
  username: string;
  password: string;
  virtual_mta: string;
  job_pool: string;
  rate_limit: number;
  max_hourly_rate: number;
}

const AccountManager = () => {
  const { currentOrganization } = useOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [accountType, setAccountType] = useState<'smtp' | 'apps-script' | 'powermta'>('smtp');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');

  // Configuration states
  const [appsScriptConfig, setAppsScriptConfig] = useState<AppsScriptConfig>({
    exec_url: '',
    script_id: '',
    deployment_id: '',
    daily_quota: 100
  });

  const [smtpConfig, setSMTPConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls',
    auth_required: true
  });

  const [powerMTAConfig, setPowerMTAConfig] = useState<PowerMTAConfig>({
    server_host: '',
    api_port: 8080,
    username: '',
    password: '',
    virtual_mta: '',
    job_pool: '',
    rate_limit: 100,
    max_hourly_rate: 1000
  });

  // ... keep existing code (resetForm function)
  const resetForm = () => {
    setAccountName('');
    setAccountEmail('');
    setEditingAccount(null);
    setAppsScriptConfig({
      exec_url: '',
      script_id: '',
      deployment_id: '',
      daily_quota: 100
    });
    setSMTPConfig({
      host: '',
      port: 587,
      username: '',
      password: '',
      encryption: 'tls',
      auth_required: true
    });
    setPowerMTAConfig({
      server_host: '',
      api_port: 8080,
      username: '',
      password: '',
      virtual_mta: '',
      job_pool: '',
      rate_limit: 100,
      max_hourly_rate: 1000
    });
  };

  // ... keep existing code (handleSave function)
  const handleSave = async () => {
    if (!accountName.trim() || !accountEmail.trim() || !currentOrganization) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    let config: any;
    switch (accountType) {
      case 'apps-script':
        config = appsScriptConfig;
        break;
      case 'smtp':
        config = smtpConfig;
        break;
      case 'powermta':
        config = powerMTAConfig;
        break;
    }

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: accountName,
          email: accountEmail,
          config
        });
        toast({
          title: "Success",
          description: "Account updated successfully"
        });
      } else {
        await addAccount({
          name: accountName,
          type: accountType,
          email: accountEmail,
          config,
          is_active: true
        });
        toast({
          title: "Success",
          description: "Account created successfully"
        });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save account",
        variant: "destructive"
      });
    }
  };

  // ... keep existing code (handleEdit function)
  const handleEdit = (account: EmailAccount) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountEmail(account.email);
    setAccountType(account.type as 'smtp' | 'apps-script' | 'powermta');
    
    if (account.type === 'apps-script') {
      setAppsScriptConfig({
        exec_url: account.config?.exec_url || '',
        script_id: account.config?.script_id || '',
        deployment_id: account.config?.deployment_id || '',
        daily_quota: account.config?.daily_quota || 100
      });
    } else if (account.type === 'smtp') {
      setSMTPConfig({
        host: account.config?.host || '',
        port: account.config?.port || 587,
        username: account.config?.username || '',
        password: account.config?.password || '',
        encryption: account.config?.encryption || 'tls',
        auth_required: account.config?.auth_required ?? true
      });
    } else if (account.type === 'powermta') {
      setPowerMTAConfig({
        server_host: account.config?.server_host || '',
        api_port: account.config?.api_port || 8080,
        username: account.config?.username || '',
        password: account.config?.password || '',
        virtual_mta: account.config?.virtual_mta || '',
        job_pool: account.config?.job_pool || '',
        rate_limit: account.config?.rate_limit || 100,
        max_hourly_rate: account.config?.max_hourly_rate || 1000
      });
    }
    
    setIsDialogOpen(true);
  };

  // ... keep existing code (handleDelete function)
  const handleDelete = async (accountId: string) => {
    try {
      await deleteAccount(accountId);
      toast({
        title: "Success",
        description: "Account deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive"
      });
    }
  };

  // ... keep existing code (handleTest function)
  const handleTest = async (account: EmailAccount) => {
    try {
      const testEmail = {
        to: account.email,
        subject: 'Test Email from Email Campaign Platform',
        html: '<h1>Test Email</h1><p>This is a test email to verify your email account configuration.</p>',
        text: 'Test Email\n\nThis is a test email to verify your email account configuration.'
      };

      if (account.type === 'apps-script') {
        await sendEmailViaAppsScript(
          account.config as any,
          account.email,
          'Test Sender',
          account.email,
          testEmail.subject,
          testEmail.html,
          testEmail.text
        );
      } else if (account.type === 'smtp') {
        await sendEmailViaSMTP(
          account.config as any,
          account.email,
          'Test Sender',
          account.email,
          testEmail.subject,
          testEmail.html,
          testEmail.text
        );
      }

      toast({
        title: "Test Successful",
        description: "Test email sent successfully"
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to send test email",
        variant: "destructive"
      });
    }
  };

  // ... keep existing code (handleSMTPTest function)
  const handleSMTPTest = async () => {
    try {
      const result = await testSMTPConnection(smtpConfig);
      if (result.success) {
        toast({
          title: "SMTP Test Successful",
          description: "SMTP connection is working correctly"
        });
      } else {
        toast({
          title: "SMTP Test Failed",
          description: result.error || "SMTP connection failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Test Error",
        description: "Failed to test SMTP connection",
        variant: "destructive"
      });
    }
  };

  // ... keep existing code (helper functions)
  const getStatusIcon = (account: EmailAccount) => {
    if (account.is_active) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'smtp': return 'SMTP';
      case 'apps-script': return 'Google Apps Script';
      case 'powermta': return 'PowerMTA';
      default: return type.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Email Account Manager</h2>
          <p className="text-slate-600">Manage your email sending accounts and configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Email Account' : 'Add New Email Account'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account-name">Account Name</Label>
                  <Input
                    id="account-name"
                    placeholder="My SMTP Account"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">From Email</Label>
                  <Input
                    id="account-email"
                    type="email"
                    placeholder="sender@domain.com"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select value={accountType} onValueChange={(value: 'smtp' | 'apps-script' | 'powermta') => setAccountType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="apps-script">Google Apps Script</SelectItem>
                    <SelectItem value="powermta">PowerMTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accountType === 'apps-script' && (
                <AppsScriptConfigForm
                  config={appsScriptConfig}
                  onChange={setAppsScriptConfig}
                />
              )}

              {accountType === 'smtp' && (
                <SMTPConfigForm
                  config={smtpConfig}
                  onChange={setSMTPConfig}
                  onTest={handleSMTPTest}
                />
              )}

              {accountType === 'powermta' && (
                <PowerMTAConfigForm
                  config={powerMTAConfig}
                  onChange={(config: PowerMTAConfig) => setPowerMTAConfig(config)}
                />
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingAccount ? 'Update Account' : 'Create Account'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ... keep existing code (accounts display section) */}
      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No email accounts configured</h3>
              <p className="text-slate-500 text-center mb-4">
                Add your first email account to start sending campaigns
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(account)}
                    <div>
                      <CardTitle className="text-lg">{account.name}</CardTitle>
                      <CardDescription>{account.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {getAccountTypeLabel(account.type)}
                    </Badge>
                    <Badge variant={account.is_active ? "default" : "destructive"}>
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTest(account)}>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(account)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(account.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AccountManager;
