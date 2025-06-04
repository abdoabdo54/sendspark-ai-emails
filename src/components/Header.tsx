
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  TestTube, 
  BarChart3, 
  Settings, 
  Users, 
  Calendar,
  Zap,
  Eye
} from 'lucide-react';
import { useOrganizations } from '@/hooks/useOrganizations';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const { currentOrganization } = useOrganizations();

  const navigationItems = [
    {
      id: 'bulk',
      label: 'Email Composer',
      icon: Mail,
      description: 'Create and send bulk email campaigns'
    },
    {
      id: 'testing',
      label: 'Campaign Testing',
      icon: TestTube,
      description: 'Test campaigns before sending'
    },
    {
      id: 'campaigns',
      label: 'Manage Campaigns',
      icon: Calendar,
      description: 'View and manage your campaigns'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      description: 'Campaign performance and insights'
    },
    {
      id: 'accounts',
      label: 'Email Accounts',
      icon: Settings,
      description: 'Manage sending accounts'
    },
    {
      id: 'tools',
      label: 'Testing Tools',
      icon: Zap,
      description: 'SMTP and DNS testing tools'
    }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Email Campaign Platform</h1>
                {currentOrganization && (
                  <p className="text-sm text-slate-600">{currentOrganization.name}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentOrganization && (
              <>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {currentOrganization.name}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {currentOrganization.subscription_plan.toUpperCase()}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="border-t border-slate-100">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={`flex items-center gap-2 whitespace-nowrap ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-800'
                  }`}
                  onClick={() => onTabChange(item.id)}
                  title={item.description}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
