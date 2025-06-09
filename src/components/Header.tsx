
import { Button } from "@/components/ui/button";
import { Mail, Settings, BarChart3, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Mail className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">EmailCampaign</span>
            </Link>
          </div>
          
          <nav className="flex space-x-4">
            <Link to="/">
              <Button
                variant={isActive('/') ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
            </Link>
            
            <Link to="/campaigns">
              <Button
                variant={isActive('/campaigns') ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <Mail className="h-4 w-4" />
                <span>Campaigns</span>
              </Button>
            </Link>
            
            <Link to="/tools">
              <Button
                variant={isActive('/tools') ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Tools</span>
              </Button>
            </Link>
            
            <Link to="/settings">
              <Button
                variant={isActive('/settings') ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
