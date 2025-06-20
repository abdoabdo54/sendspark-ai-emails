
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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
import { 
  Building2, 
  Settings, 
  Server, 
  Globe, 
  LogOut, 
  Plus, 
  ChevronDown,
  Mail,
  BarChart3,
  Users,
  History,
  User
} from 'lucide-react';
import OrganizationDialog from './OrganizationDialog';
import DomainServerManager from './DomainServerManager';

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization, organizations, setCurrentOrganization } = useSimpleOrganizations();
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showDomainManager, setShowDomainManager] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleOrgSwitch = (org: any) => {
    setCurrentOrganization(org);
  };

  const handleTabNavigation = (tab: string) => {
    console.log('Header: Navigating to tab:', tab);
    
    // Handle direct page navigation
    if (tab === 'campaigns' || tab === 'history') {
      navigate('/campaigns');
    } else if (tab === 'smart-config') {
      navigate('/smart-config');
    } else if (tab === 'function-manager') {
      navigate('/function-manager');
    } else if (tab === 'powermta-servers') {
      navigate('/powermta-servers');
    } else if (tab === 'settings') {
      navigate('/settings');
    } else {
      // Handle tabs within the main page
      navigate('/');
      if (onTabChange) {
        onTabChange(tab);
      }
    }
  };

  // Determine the current active state based on location and activeTab
  const getCurrentActiveTab = (itemId: string) => {
    if (location.pathname === '/campaigns') {
      return itemId === 'campaigns' || itemId === 'history';
    } else if (location.pathname === '/smart-config') {
      return itemId === 'smart-config';
    } else if (location.pathname === '/function-manager') {
      return itemId === 'function-manager';
    } else if (location.pathname === '/powermta-servers') {
      return itemId === 'powermta-servers';
    } else if (location.pathname === '/settings') {
      return itemId === 'settings';
    } else if (location.pathname === '/') {
      return activeTab === itemId;
    }
    return false;
  };

  const navItems = [
    { id: 'campaign', label: 'Campaign Composer', icon: Mail, onClick: () => handleTabNavigation('campaign') },
    { id: 'single', label: 'Single Email', icon: Mail, onClick: () => handleTabNavigation('single') },
    { id: 'campaigns', label: 'Campaign History', icon: History, onClick: () => handleTabNavigation('campaigns') },
    { id: 'function-manager', label: 'Functions', icon: Settings, onClick: () => handleTabNavigation('function-manager') },
    { id: 'powermta-servers', label: 'PowerMTA', icon: Server, onClick: () => handleTabNavigation('powermta-servers') },
    { id: 'settings', label: 'Settings', icon: Settings, onClick: () => handleTabNavigation('settings') },
  ];

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EmailCampaign Pro
            </Link>
            {currentOrganization && (
              <Badge variant="outline" className="text-sm">
                {currentOrganization.name}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Tabs */}
            <div className="hidden md:flex items-center space-x-2">
              {navItems.map((item) => {
                const isActive = getCurrentActiveTab(item.id);
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={item.onClick}
                    className="flex items-center gap-2"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>

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
                    onClick={() => handleOrgSwitch(org)}
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
                <DropdownMenuItem onClick={() => handleTabNavigation('settings')}>
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

        {/* Mobile Navigation */}
        <div className="md:hidden mt-4 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = getCurrentActiveTab(item.id);
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={item.onClick}
                  className="flex items-center gap-2"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
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
