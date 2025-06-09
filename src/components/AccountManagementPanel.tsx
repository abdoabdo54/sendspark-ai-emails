
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, TestTube, Settings2 } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';

interface AccountFormData {
  name: string;
  email: string;
  type: 'smtp' | 'apps-script';
  is_active: boolean;
  config: {
    // SMTP Config
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    encryption?: 'none' | 'tls' | 'ssl';
    auth_required?: boolean;
    // Apps Script Config
    script_id?: string;
    deployment_id?: string;
    exec_url?: string;
    daily_quota?: number;
    // Rate Limiting
    emails_per_second?: number;
    emails_per_hour?: number;
    max_daily_emails?: number;
    // Rotation Settings
    from_names?: string[];
    subjects?: string[];
    rotation_enabled?: boolean;
  };
}

const AccountManagementPanel = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [activeTab, setActiveTab] = useState('list');
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    email: '',
    type: 'smtp',
    is_active: true,
    config: {
      emails_per_second: 1,
      emails_per_hour: 3600,
      max_daily_emails: 10000,
      rotation_enabled: false,
      from_names: [],
      subjects: []
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      type: 'smtp',
      is_active: true,
      config: {
        emails_per_second: 1,
        emails_per_hour: 3600,
        max_daily_emails: 10000,
        rotation_enabled: false,
        from_names: [],
        subjects: []
      }
    });
    setEditingAccount(null);
  };

  const handleSave = async () => {
    try {
      if (editingAccount) {
        await updateAccount(editingAccount, formData);
        toast({
          title: "Success",
          description: "Account updated successfully"
        });
      } else {
        await addAccount(formData);
        toast({
          title: "Success", 
          description: "Account created successfully"
        });
      }
      resetForm();
      setActiveTab('list');
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save account: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (account: any) => {
    setFormData({
      name: account.name,
      email: account.email,
      type: account.type,
      is_active: account.is_active,
      config: {
        ...account.config,
        emails_per_second: account.config?.emails_per_second || 1,
        emails_per_hour: account.config?.emails_per_hour || 3600,
        max_daily_emails: account.config?.max_daily_emails || 10000,
        rotation_enabled: account.config?.rotation_enabled || false,
        from_names: account.config?.from_names || [],
        subjects: account.config?.subjects || []
      }
    });
    setEditingAccount(account.id);
    setActiveTab('form');
  };

  const updateFormConfig = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  const addFromName = () => {
    const fromNames = formData.config.from_names || [];
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        from_names: [...fromNames, '']
      }
    }));
  };

  const updateFromName = (index: number, value: string) => {
    const fromNames = [...(formData.config.from_names || [])];
    fromNames[index] = value;
    updateFormConfig('from_names', fromNames);
  };

  const removeFromName = (index: number) => {
    const fromNames = formData.config.from_names || [];
    updateFormConfig('from_names', fromNames.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading accounts...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Email Account Management
        </CardTitle>
        <CardDescription>
          Manage your SMTP and Google Apps Script accounts with advanced rate limiting and rotation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Accounts ({accounts.length})</TabsTrigger>
            <TabsTrigger value="form">
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Your Email Accounts</h3>
              <Button 
                onClick={() => {
                  resetForm();
                  setActiveTab('form');
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Account
              </Button>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No email accounts configured. Add your first account to get started.
              </div>
            ) : (
              <div className="grid gap-4">
                {accounts.map((account) => (
                  <Card key={account.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{account.name}</h4>
                          <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">
                            {account.type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{account.email}</p>
                        <div className="text-xs text-gray-500">
                          Rate: {account.config?.emails_per_second || 1}/sec | 
                          {account.config?.emails_per_hour || 3600}/hour |
                          Max Daily: {account.config?.max_daily_emails || 10000}
                        </div>
                        {account.config?.rotation_enabled && (
                          <div className="text-xs text-blue-600">
                            Rotation: {account.config.from_names?.length || 0} names, 
                            {account.config.subjects?.length || 0} subjects
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(account)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAccount(account.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="form" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My SMTP Account"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="sender@domain.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Account Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'smtp' | 'apps-script') => 
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP Server</SelectItem>
                    <SelectItem value="apps-script">Google Apps Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="active">Account Active</Label>
              </div>
            </div>

            {/* SMTP Configuration */}
            {formData.type === 'smtp' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">SMTP Configuration</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">SMTP Host *</Label>
                    <Input
                      id="host"
                      value={formData.config.host || ''}
                      onChange={(e) => updateFormConfig('host', e.target.value)}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port *</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.config.port || 587}
                      onChange={(e) => updateFormConfig('port', parseInt(e.target.value) || 587)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.config.username || ''}
                      onChange={(e) => updateFormConfig('username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.config.password || ''}
                      onChange={(e) => updateFormConfig('password', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="encryption">Encryption</Label>
                    <Select 
                      value={formData.config.encryption || 'tls'}
                      onValueChange={(value) => updateFormConfig('encryption', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="tls">TLS</SelectItem>
                        <SelectItem value="ssl">SSL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Apps Script Configuration */}
            {formData.type === 'apps-script' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Google Apps Script Configuration</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="script_id">Script ID *</Label>
                    <Input
                      id="script_id"
                      value={formData.config.script_id || ''}
                      onChange={(e) => updateFormConfig('script_id', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deployment_id">Deployment ID *</Label>
                    <Input
                      id="deployment_id"
                      value={formData.config.deployment_id || ''}
                      onChange={(e) => updateFormConfig('deployment_id', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="exec_url">Execution URL *</Label>
                    <Input
                      id="exec_url"
                      value={formData.config.exec_url || ''}
                      onChange={(e) => updateFormConfig('exec_url', e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily_quota">Daily Quota</Label>
                    <Input
                      id="daily_quota"
                      type="number"
                      value={formData.config.daily_quota || 100}
                      onChange={(e) => updateFormConfig('daily_quota', parseInt(e.target.value) || 100)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rate Limiting Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rate Limiting</CardTitle>
                <CardDescription>Control sending speed and limits for this account</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emails_per_second">Emails per Second</Label>
                  <Input
                    id="emails_per_second"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.config.emails_per_second || 1}
                    onChange={(e) => updateFormConfig('emails_per_second', parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emails_per_hour">Emails per Hour</Label>
                  <Input
                    id="emails_per_hour"
                    type="number"
                    value={formData.config.emails_per_hour || 3600}
                    onChange={(e) => updateFormConfig('emails_per_hour', parseInt(e.target.value) || 3600)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_daily_emails">Max Daily Emails</Label>
                  <Input
                    id="max_daily_emails"
                    type="number"
                    value={formData.config.max_daily_emails || 10000}
                    onChange={(e) => updateFormConfig('max_daily_emails', parseInt(e.target.value) || 10000)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rotation Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Rotation Settings</CardTitle>
                    <CardDescription>Enable round-robin rotation for FROM names and subjects</CardDescription>
                  </div>
                  <Switch
                    checked={formData.config.rotation_enabled || false}
                    onCheckedChange={(checked) => updateFormConfig('rotation_enabled', checked)}
                  />
                </div>
              </CardHeader>
              {formData.config.rotation_enabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>FROM Names (one per line)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addFromName}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Name
                      </Button>
                    </div>
                    {(formData.config.from_names || []).map((name, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={name}
                          onChange={(e) => updateFromName(index, e.target.value)}
                          placeholder="John Doe"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFromName(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleSave} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {editingAccount ? 'Update Account' : 'Save Account'}
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('list')}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AccountManagementPanel;
