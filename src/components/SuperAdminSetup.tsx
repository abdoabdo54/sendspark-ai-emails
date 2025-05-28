
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SuperAdminSetup = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateSuperAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const orgName = formData.get('orgName') as string;
    const subdomain = formData.get('subdomain') as string;
    const domain = formData.get('domain') as string;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('Creating super admin organization for user:', user.id);

      // Call the edge function to create super admin organization
      const { data, error } = await supabase.functions.invoke('create-super-admin', {
        body: {
          orgName,
          subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          domain: domain || null,
          userId: user.id
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create super admin organization');
      }

      toast({
        title: "Success",
        description: "Super Admin account created successfully! You now have full platform access."
      });

      // Refresh the page to load the new organization
      window.location.reload();
    } catch (error) {
      console.error('Super admin setup error:', error);
      toast({
        title: "Error",
        description: `Failed to create super admin account: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-lg border-2 border-purple-200">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-purple-600" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Super Admin Setup
          </CardTitle>
          <CardDescription className="text-lg">
            Create your super administrator account to manage the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSuperAdmin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="orgName">Platform Organization Name</Label>
              <Input
                id="orgName"
                name="orgName"
                placeholder="EmailPro Platform"
                required
              />
              <p className="text-sm text-gray-500">
                This will be your main platform organization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Platform Subdomain</Label>
              <Input
                id="subdomain"
                name="subdomain"
                placeholder="platform"
                required
                pattern="[a-z0-9-]+"
                title="Only lowercase letters, numbers, and hyphens allowed"
              />
              <p className="text-sm text-gray-500">
                Used for platform administration and client onboarding
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Custom Domain (Optional)</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="your-platform.com"
                type="url"
              />
              <p className="text-sm text-gray-500">
                Your platform's primary domain
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">Super Admin Privileges:</h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Manage all client organizations</li>
                <li>• Access platform-wide analytics</li>
                <li>• Configure global settings</li>
                <li>• Monitor system health</li>
                <li>• Unlimited email sending</li>
              </ul>
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" disabled={isLoading}>
              {isLoading ? 'Creating Super Admin Account...' : 'Create Super Admin Account'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminSetup;
