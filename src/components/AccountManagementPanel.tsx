
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Edit, Plus } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';

const AccountManagementPanel = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useEmailAccounts(currentOrganization?.id);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'smtp' as 'smtp' | 'apps-script' | 'powermta',
    is_active: true,
    config: {
      // SMTP specific
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      // Apps Script specific
      script_url: '',
      // Rate limiting (common for all types)
      emails_per_second: 1,
      emails_per_hour: 3600,
      // Rotation settings
      rotation_enabled: false,
      from_names: [] as string[],
      subjects: [] as string[]
    }
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization first",
        variant: "destructive"
      });
      return;
    }

    try {
      const accountData = {
        name: formData.name,
        email: formData.email,
        type: formData.type,
        is_active: formData.is_active,
        config: {
          ...formData.config,
          emails_per_second: Number(formData.config.emails_per_second) || 1,
          emails_per_hour: Number(formData.config.emails_per_hour) || 3600
        }
      };

      if (editingId) {
        await updateAccount(editingId, accountData);
        setEditingId(null);
      } else {
        await addAccount(accountData);
      }
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      type: 'smtp',
      is_active: true,
      config: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        script_url: '',
        emails_per_second: 1,
        emails_per_hour: 3600,
        rotation_enabled: false,
        from_names: [],
        subjects: []
      }
    });
  };

  const handleEdit = (account: any) => {
    setFormData({
      name: account.name,
      email: account.email,
      type: account.type,
      is_active: account.is_active,
      config: {
        host: account.config?.host || '',
        port: account.config?.port || 587,
        secure: account.config?.secure || false,
        user: account.config?.user || '',
        pass: account.config?.pass || '',
        script_url: account.config?.script_url || '',
        emails_per_second: account.config?.emails_per_second || 1,
        emails_per_hour: account.config?.emails_per_hour || 3600,
        rotation_enabled: account.config?.rotation_enabled || false,
        from_names: account.config?.from_names || [],
        subjects: account.config?.subjects || []
      }
    });
    setEditingId(account.id);
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

  const handleConfigChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
  };

  if (!currentOrganization?.id) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-600">
            Please select an organization to manage email accounts.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {editingId ? 'Edit Email Account' : 'Add Email Account'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Email Account"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="type">Account Type *</Label>
                <Select value={formData.type} onValueChange={(value: 'smtp' | 'apps-script' | 'powermta') => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="apps-script">Google Apps Script</SelectItem>
                    <SelectItem value="powermta">PowerMTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="emailsPerSecond">Emails per Second</Label>
                <Input
                  id="emailsPerSecond"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formData.config.emails_per_second}
                  onChange={(e) => handleConfigChange('emails_per_second', parseFloat(e.target.value) || 1)}
                  placeholder="1"
                />
              </div>

              <div>
                <Label htmlFor="emailsPerHour">Emails per Hour</Label>
                <Input
                  id="emailsPerHour"
                  type="number"
                  min="1"
                  value={formData.config.emails_per_hour}
                  onChange={(e) => handleConfigChange('emails_per_hour', parseInt(e.target.value) || 3600)}
                  placeholder="3600"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Account Active</Label>
            </div>

            {formData.type === 'smtp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <h4 className="col-span-full font-medium">SMTP Configuration</h4>
                <div>
                  <Label htmlFor="host">SMTP Host *</Label>
                  <Input
                    id="host"
                    value={formData.config.host}
                    onChange={(e) => handleConfigChange('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.config.port}
                    onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="user">Username *</Label>
                  <Input
                    id="user"
                    value={formData.config.user}
                    onChange={(e) => handleConfigChange('user', e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="pass">Password *</Label>
                  <Input
                    id="pass"
                    type="password"
                    value={formData.config.pass}
                    onChange={(e) => handleConfigChange('pass', e.target.value)}
                    placeholder="Your app password"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.config.secure}
                    onCheckedChange={(checked) => handleConfigChange('secure', checked)}
                  />
                  <Label>Use TLS/SSL</Label>
                </div>
              </div>
            )}

            {formData.type === 'apps-script' && (
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Google Apps Script Configuration</h4>
                <div>
                  <Label htmlFor="scriptUrl">Apps Script URL *</Label>
                  <Input
                    id="scriptUrl"
                    value={formData.config.script_url}
                    onChange={(e) => handleConfigChange('script_url', e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    required
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Deploy your Apps Script as a web app and paste the URL here
                  </p>
                </div>
              </div>
            )}

            {formData.type === 'powermta' && (
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">PowerMTA Configuration</h4>
                <p className="text-sm text-slate-500">
                  PowerMTA configuration will be available in future updates.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit">
                {editingId ? 'Update Account' : 'Add Account'}
              </Button>
              {editingId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No email accounts configured yet. Add your first account above.
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{account.name}</h3>
                        <Badge variant="outline">{account.type}</Badge>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{account.email}</p>
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Rate Limits: {account.config?.emails_per_second || 1}/sec, {account.config?.emails_per_hour || 3600}/hour</div>
                        {account.type === 'smtp' && account.config?.host && (
                          <div>SMTP: {account.config.host}:{account.config.port}</div>
                        )}
                        {account.type === 'apps-script' && account.config?.script_url && (
                          <div>Script: {account.config.script_url.substring(0, 50)}...</div>
                        )}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountManagementPanel;
