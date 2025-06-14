import React, { useState } from 'react';
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
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { Building2, Globe } from 'lucide-react';

interface OrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const OrganizationDialog: React.FC<OrganizationDialogProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useSimpleOrganizations();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    domain: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await createOrganization(
        formData.name,
        formData.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '')
      );
      
      setFormData({ name: '', subdomain: '', domain: '' });
      onClose();
    } catch (error) {
      console.error('Error creating organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization to manage your email campaigns.
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

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationDialog;
