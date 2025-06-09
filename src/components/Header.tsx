
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { Building2, Settings, Server, Globe, LogOut, Plus, ChevronDown } from 'lucide-react';
import OrganizationDialog from './OrganizationDialog';
import DomainServerManager from './DomainServerManager';

const Header = () => {
  const { user, signOut } = useAuth();
  const { currentOrganization, organizations } = useSimpleOrganizations();
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showDomainManager, setShowDomainManager] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EmailCampaign Pro
            </h1>
            {currentOrganization && (
              <Badge variant="outline" className="text-sm">
                {currentOrganization.name}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Domain & Server Management */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDomainManager(true)}
              className="flex items-center gap-2"
            >
              <Server className="w-4 h-4" />
              Domains & Servers
            </Button>

            {/* Organization Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Organizations
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1 text-sm font-medium text-gray-500">
                  Switch Organization
                </div>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    className={`cursor-pointer ${
                      currentOrganization?.id === org.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{org.name}</span>
                      <span className="text-xs text-gray-500">{org.subdomain}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowOrgDialog(true)}
                  className="cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  {user?.email}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <OrganizationDialog 
        isOpen={showOrgDialog} 
        onClose={() => setShowOrgDialog(false)} 
      />

      <DomainServerManager
        isOpen={showDomainManager}
        onClose={() => setShowDomainManager(false)}
      />
    </>
  );
};

export default Header;
