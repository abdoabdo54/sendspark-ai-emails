
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Settings, 
  Send, 
  BarChart3, 
  Zap, 
  Calculator,
  Server,
  Wrench,
  Menu,
  X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import OrganizationDialog from './OrganizationDialog';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useSimpleOrganizations();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Campaigns', icon: Mail },
    { path: '/send-email', label: 'Send Email', icon: Send },
    { path: '/campaigns', label: 'History', icon: BarChart3 },
    { path: '/function-manager', label: 'Functions', icon: Zap },
    { path: '/smart-config', label: 'SmartConfig', icon: Calculator },
    { path: '/powermta-servers', label: 'PowerMTA', icon: Server },
    { path: '/tools', label: 'Tools', icon: Wrench },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Organization */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Email Pro</span>
            </div>
            
            {currentOrganization && (
              <Badge variant="outline" className="hidden sm:flex">
                {currentOrganization.name}
              </Badge>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Mobile menu button and Organization */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOrgDialogOpen(true)}
            >
              Organizations
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-2">
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant={isActive(item.path) ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 justify-start"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <OrganizationDialog 
        isOpen={isOrgDialogOpen} 
        onClose={() => setIsOrgDialogOpen(false)} 
      />
    </header>
  );
};

export default Header;
