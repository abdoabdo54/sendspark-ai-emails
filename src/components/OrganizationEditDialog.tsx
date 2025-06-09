
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserOrganizations } from '@/hooks/useUserOrganizations';
import { Building2, Globe, Plus, Edit } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  subscription_plan: string;
  is_active: boolean;
  monthly_email_limit: number;
  emails_sent_this_month: number;
}

interface OrganizationEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization?: Organization | null;
}

const OrganizationEditDialog: React.FC<OrganizationEditDialogProps> = ({ 
  isOpen, 
  onClose, 
  organization 
}) => {
  const { createOrganization, updateOrganization } = useUserOrganizations();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    domain: '',
    subscription_plan: 'free' as 'free' | 'pro' | 'enterprise',
    monthly_email_limit: 1000
  });

  const isEditing = !!organization;

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        subdomain: organization.subdomain,
        domain: organization.domain || '',
        subscription_plan: organization.subscription_plan as 'free' | 'pro' | 'enterprise',
        monthly_email_limit: organization.monthly_email_limit
      });
    } else {
      setFormData({
        name: '',
        subdomain: '',
        domain: '',
        subscription_plan: 'free',
        monthly_email_limit: 1000
      });
    }
  }, [organization, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isEditing && organization) {
        await updateOrganization(organization.id, {
          name: formData.name,
          domain: formData.domain || undefined,
          subscription_plan: formData.subscription_plan,
          monthly_email_limit: formData.monthly_email_limit
        });
      } else {
        await createOrganization({
          name: formData.name,
          subdomain: formData.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          domain: formData.domain || undefined
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {isEditing ? 'Edit Organization' : 'Create New Organization'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update your organization settings and configuration.'
              : 'Set up a new organization to manage your email campaigns.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="org-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your Company Name"
                className="pl-10"
                required
              />
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="org-subdomain">Subdomain</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="org-subdomain"
                  value={formData.subdomain}
                  onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value }))}
                  placeholder="your-company"
                  className="pl-10"
                  required
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens allowed"
                />
              </div>
              <p className="text-sm text-gray-500">
                Used for email tracking and unsubscribe pages
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="org-domain">Custom Domain (Optional)</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="org-domain"
                value={formData.domain}
                onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="yourcompany.com"
                className="pl-10"
              />
            </div>
            <p className="text-sm text-gray-500">
              Use your own domain for sending emails (requires DNS setup)
            </p>
          </div>

          {isEditing && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subscription-plan">Subscription Plan</Label>
                <Select 
                  value={formData.subscription_plan} 
                  onValueChange={(value: 'free' | 'pro' | 'enterprise') => 
                    setFormData(prev => ({ ...prev, subscription_plan: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (1,000 emails/month)</SelectItem>
                    <SelectItem value="pro">Pro (10,000 emails/month)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-limit">Monthly Email Limit</Label>
                <Input
                  id="email-limit"
                  type="number"
                  value={formData.monthly_email_limit}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    monthly_email_limit: parseInt(e.target.value) || 1000 
                  }))}
                  placeholder="1000"
                  min="1"
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading 
                ? (isEditing ? 'Updating...' : 'Creating...') 
                : (isEditing ? 'Update Organization' : 'Create Organization')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationEditDialog;
