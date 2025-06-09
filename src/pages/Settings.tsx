
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from 'lucide-react';
import SettingsPanel from '../components/SettingsPanel';

const Settings = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
          </div>
          <p className="text-slate-600">
            Configure your email campaign application preferences and integrations
          </p>
        </div>
        
        <SettingsPanel />
      </div>
    </div>
  );
};

export default Settings;
