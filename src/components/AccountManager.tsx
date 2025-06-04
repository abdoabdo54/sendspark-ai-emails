import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TestTube, Loader2, CheckCircle, XCircle, Eye, EyeOff, FileText, Mail, CopyPlus, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEmailAccounts, EmailAccount } from '@/hooks/useEmailAccounts';
import { AppsScriptConfigForm } from '@/components/AppsScriptConfigForm';
import { SMTPConfigForm } from '@/components/SMTPConfigForm';
import { PowerMTAConfigForm } from '@/components/PowerMTAConfigForm';
import { useOrganizations } from '@/hooks/useOrganizations';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';

interface AppsScriptConfig {
  exec_url: string;
  script_id?: string;
  deployment_id?: string;
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
  api_url: string;
  api_key: string;
}

const AccountManager = () => {
  const { currentOrganization } = useOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [newAccount, setNewAccount] = useState<{
    name: string;
    type: 'apps-script' | 'powermta' | 'smtp';
    email: string;
    is_active: boolean;
    config: AppsScriptConfig | SMTPConfig | PowerMTAConfig;
  }>({
    name: '',
    type: 'apps-script',
    email: '',
    is_active: true,
    config: {
      exec_url: '',
      daily_quota: 100
    }
  });

  const handleAddAccount = async () => {
    try {
      await addAccount({
        ...newAccount,
        config: newAccount.config
      });
      setNewAccount({
        name: '',
        type: 'apps-script',
        email: '',
        is_active: true,
        config: {
          exec_url: '',
          daily_quota: 100
        }
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;
    try {
      await updateAccount(selectedAccount.id, {
        ...selectedAccount,
        config: selectedAccount.config
      });
      setEditOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      console.error('Failed to update account:', error);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteAccount(id);
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleSendTestEmail = async (account: EmailAccount) => {
    if (!account) {
      toast({
        title: "Missing Account",
        description: "Please select an email account",
        variant: "destructive"
      });
      return;
    }

    if (!account.email) {
      toast({
        title: "Missing Email",
        description: "Please enter a sender email address",
        variant: "destructive"
      });
      return;
    }

    const toEmail = prompt("Enter recipient email address:");
    if (!toEmail) return;

    const fromName = account.name || 'Test Sender';
    const subject = 'Test Email';
    const htmlContent = '<p>This is a test email</p>';
    const textContent = 'This is a test email';

    if (account.type === 'apps-script') {
      await sendEmailViaAppsScript(account, account.email, fromName, toEmail, subject, htmlContent, textContent);
    } else {
      toast({
        title: "Not Implemented",
        description: "Sending test email is not implemented for this account type",
        variant: "destructive"
      });
    }
  };

  const sendEmailViaAppsScript = async (account: EmailAccount, fromEmail: string, fromName: string, toEmail: string, subject: string, htmlContent: string, textContent?: string) => {
  try {
    console.log('Sending email via Apps Script account:', account.name);
    
    const result = await sendEmailViaAppsScript(
      account.config,
      fromEmail,
      fromName,
      toEmail,
      subject,
      htmlContent,
      textContent
    );

    if (result.success) {
      console.log('✓ Email sent successfully via Apps Script');
      toast({
        title: "Email Sent",
        description: `Email sent successfully via ${account.name}`,
      });
      return { success: true };
    } else {
      console.error('✗ Apps Script sending failed:', result.error);
      toast({
        title: "Send Failed",
        description: result.error || "Failed to send email via Apps Script",
        variant: "destructive"
      });
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('✗ Apps Script error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    toast({
      title: "Send Error",
      description: errorMessage,
      variant: "destructive"
    });
    return { success: false, error: errorMessage };
  }
};

  if (loading) {
    return <div>Loading email accounts...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Email Account Management</h3>
          <p className="text-slate-600">
            Manage your email accounts for sending campaigns
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Accounts</CardTitle>
            <CardDescription>
              Manage your email accounts for sending campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No email accounts found</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {accounts.map((account) => (
                  <Card key={account.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-blue-600" />
                          <div>
                            <CardTitle className="text-lg">{account.name}</CardTitle>
                            <CardDescription className="text-sm">{account.email}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            id={`account-active-${account.id}`}
                            checked={account.is_active}
                            onCheckedChange={async (checked) => {
                              try {
                                await updateAccount(account.id, { is_active: checked });
                              } catch (error) {
                                console.error('Failed to update account status:', error);
                              }
                            }}
                          />
                          <Label htmlFor={`account-active-${account.id}`} className="text-sm">
                            {account.is_active ? 'Active' : 'Inactive'}
                          </Label>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">Type:</span> {account.type}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {new Date(account.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSendTestEmail(account)}
                        >
                          <TestTube className="w-4 h-4 mr-2" />
                          Test
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(account);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteAccount(account.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button onClick={() => setOpen(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Email Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Email Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  placeholder="My Email Account"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email Address</Label>
                <Input
                  id="account-email"
                  type="email"
                  placeholder="email@example.com"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select onValueChange={(value: any) => setNewAccount({ 
                ...newAccount, 
                type: value,
                config: value === 'apps-script' ? { exec_url: '', daily_quota: 100 } : 
                        value === 'smtp' ? { host: '', port: 587, username: '', password: '', encryption: 'tls', auth_required: true } :
                        { api_url: '', api_key: '' }
              })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apps-script">Google Apps Script</SelectItem>
                  <SelectItem value="smtp">SMTP</SelectItem>
                  <SelectItem value="powermta">PowerMTA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newAccount.type === 'apps-script' && (
              <AppsScriptConfigForm
                config={newAccount.config as AppsScriptConfig}
                onChange={(config: AppsScriptConfig) => setNewAccount({ ...newAccount, config: config })}
              />
            )}

            {newAccount.type === 'smtp' && (
              <SMTPConfigForm
                config={newAccount.config as SMTPConfig}
                onChange={(config: SMTPConfig) => setNewAccount({ ...newAccount, config: config })}
              />
            )}

            {newAccount.type === 'powermta' && (
              <PowerMTAConfigForm
                config={newAccount.config as PowerMTAConfig}
                onChange={(config: PowerMTAConfig) => setNewAccount({ ...newAccount, config: config })}
              />
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="account-active"
                checked={newAccount.is_active}
                onCheckedChange={(checked) => setNewAccount({ ...newAccount, is_active: checked })}
              />
              <Label htmlFor="account-active">Account Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddAccount}>
              Add Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Email Account</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account-name">Account Name</Label>
                  <Input
                    id="account-name"
                    placeholder="My Email Account"
                    value={selectedAccount.name}
                    onChange={(e) => setSelectedAccount({ ...selectedAccount, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">Email Address</Label>
                  <Input
                    id="account-email"
                    type="email"
                    placeholder="email@example.com"
                    value={selectedAccount.email}
                    onChange={(e) => setSelectedAccount({ ...selectedAccount, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type</Label>
                <Select 
                  value={selectedAccount.type}
                  onValueChange={(value: any) => setSelectedAccount({ 
                    ...selectedAccount, 
                    type: value,
                    config: value === 'apps-script' ? { exec_url: '', daily_quota: 100 } : 
                            value === 'smtp' ? { host: '', port: 587, username: '', password: '', encryption: 'tls', auth_required: true } :
                            { api_url: '', api_key: '' }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apps-script">Google Apps Script</SelectItem>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="powermta">PowerMTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedAccount.type === 'apps-script' && (
                <AppsScriptConfigForm
                  config={selectedAccount.config as AppsScriptConfig}
                  onChange={(config: AppsScriptConfig) => setSelectedAccount({ ...selectedAccount, config: config })}
                />
              )}

              {selectedAccount.type === 'smtp' && (
                <SMTPConfigForm
                  config={selectedAccount.config as SMTPConfig}
                  onChange={(config: SMTPConfig) => setSelectedAccount({ ...selectedAccount, config: config })}
                />
              )}

              {selectedAccount.type === 'powermta' && (
                <PowerMTAConfigForm
                  config={selectedAccount.config as PowerMTAConfig}
                  onChange={(config: PowerMTAConfig) => setSelectedAccount({ ...selectedAccount, config: config })}
                />
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="account-active"
                  checked={selectedAccount.is_active}
                  onCheckedChange={(checked) => setSelectedAccount({ ...selectedAccount, is_active: checked })}
                />
                <Label htmlFor="account-active">Account Active</Label>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateAccount}>
              Update Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountManager;
