
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, RefreshCw } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { toast } from '@/hooks/use-toast';

const AccountManager = () => {
  const { currentOrganization, loading: orgLoading } = useSimpleOrganizations();
  const { accounts, loading, addAccount, updateAccount, deleteAccount, refetch } = useEmailAccounts(currentOrganization?.id);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'smtp' as 'smtp' | 'apps-script' | 'powermta',
    config: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      script_url: '',
      emails_per_second: 1,
      emails_per_hour: 3600
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Prevent infinite refresh by only initializing once when organization is ready
  useEffect(() => {
    if (currentOrganization?.id && !hasInitialized && !orgLoading) {
      console.log('AccountManager initializing for organization:', currentOrganization.id);
      setHasInitialized(true);
    }
  }, [currentOrganization?.id, orgLoading, hasInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "Please ensure organization is properly set up",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const accountData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        type: formData.type,
        is_active: true,
        config: {
          ...formData.config,
          emails_per_second: Number(formData.config.emails_per_second) || 1,
          emails_per_hour: Number(formData.config.emails_per_hour) || 3600
        }
      };

      if (editingId) {
        await updateAccount(editingId, accountData);
        setEditingId(null);
        toast({
          title: "Success",
          description: "Account updated successfully"
        });
      } else {
        await addAccount(accountData);
        toast({
          title: "Success",
          description: "Account added successfully"
        });
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
          pass: '',
          script_url: '',
          emails_per_second: 1,
          emails_per_hour: 3600
        }
      });

    } catch (error) {
      console.error('Error saving account:', error);
      toast({
        title: "Error",
        description: "Failed to save account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: any) => {
    setFormData({
      name: account.name,
      email: account.email,
      type: account.type,
      config: {
        host: account.config?.host || '',
        port: account.config?.port || 587,
        secure: account.config?.secure || false,
        user: account.config?.user || '',
        pass: account.config?.pass || '',
        script_url: account.config?.script_url || '',
        emails_per_second: account.config?.emails_per_second || 1,
        emails_per_hour: account.config?.emails_per_hour || 3600
      }
    });
    setEditingId(account.id);
  };

  const handleDelete = async (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(accountId);
        toast({
          title: "Success",
          description: "Account deleted successfully"
        });
      } catch (error) {
        console.error('Error deleting account:', error);
        toast({
          title: "Error",
          description: "Failed to delete account",
          variant: "destructive"
        });
      }
    }
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {editingId ? 'Edit Email Account' : 'Add Email Account'}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="type">Account Type</Label>
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, emails_per_second: parseFloat(e.target.value) || 1 }
                  }))}
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
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, emails_per_hour: parseInt(e.target.value) || 3600 }
                  }))}
                  placeholder="3600"
                />
              </div>
            </div>

            {formData.type === 'smtp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="host">SMTP Host</Label>
                  <Input
                    id="host"
                    value={formData.config.host}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, host: e.target.value }
                    }))}
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
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, port: parseInt(e.target.value) }
                    }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="user">Username</Label>
                  <Input
                    id="user"
                    value={formData.config.user}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, user: e.target.value }
                    }))}
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
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, pass: e.target.value }
                    }))}
                    placeholder="Your app password"
                    required
                  />
                </div>
              </div>
            )}

            {formData.type === 'apps-script' && (
              <div>
                <Label htmlFor="scriptUrl">Apps Script URL</Label>
                <Input
                  id="scriptUrl"
                  value={formData.config.script_url}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, script_url: e.target.value }
                  }))}
                  placeholder="https://script.google.com/macros/s/..."
                  required
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (editingId ? 'Update Account' : 'Add Account')}
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
                        pass: '',
                        script_url: '',
                        emails_per_second: 1,
                        emails_per_hour: 3600
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
                      <h3 className="font-medium">{account.name}</h3>
                      <p className="text-sm text-slate-600">{account.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{account.type}</Badge>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Rate: {account.config?.emails_per_second || 1}/sec, {account.config?.emails_per_hour || 3600}/hour
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
