
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';

const AccountManager = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { accounts, loading, createAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'smtp',
    config: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: ''
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      refetch();
    }
  }, [currentOrganization?.id, refetch]);

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
        ...formData,
        organization_id: currentOrganization.id
      };

      if (editingId) {
        await updateAccount(editingId, accountData);
        setEditingId(null);
      } else {
        await createAccount(accountData);
      }
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        type: 'smtp',
        config: {
          host: '',
          port: 587,
          secure: false,
          user: '',
          pass: ''
        }
      });
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleEdit = (account: any) => {
    setFormData({
      name: account.name,
      email: account.email,
      type: account.type,
      config: account.config || {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: ''
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
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Email Account"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email Address</Label>
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

            <div>
              <Label htmlFor="type">Account Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
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

            {formData.type === 'smtp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    value={formData.config.host}
                    onChange={(e) => handleConfigChange('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.config.port}
                    onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    value={formData.config.user}
                    onChange={(e) => handleConfigChange('user', e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="pass">Password</Label>
                  <Input
                    id="pass"
                    type="password"
                    value={formData.config.pass}
                    onChange={(e) => handleConfigChange('pass', e.target.value)}
                    placeholder="Your app password"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? 'Update Account' : 'Add Account'}
              </Button>
              {editingId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      name: '',
                      email: '',
                      type: 'smtp',
                      config: {
                        host: '',
                        port: 587,
                        secure: false,
                        user: '',
                        pass: ''
                      }
                    });
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
          <CardTitle>Email Accounts</CardTitle>
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
                      <h3 className="font-medium">{account.name}</h3>
                      <p className="text-sm text-slate-600">{account.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{account.type}</Badge>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountManager;
