
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Bell, Mail, Sparkles, Save, Cloud, BookOpen } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import GlobalGoogleCloudConfig from './GlobalGoogleCloudConfig';
import GoogleCloudSetupGuide from './GoogleCloudSetupGuide';

const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    // General Settings
    defaultFromName: 'Your Company',
    defaultSignature: '',
    maxRecipientsPerBatch: 100,
    
    // API Settings
    geminiApiKey: '',
    
    // Notification Settings
    emailNotifications: true,
    successNotifications: true,
    errorNotifications: true,
    
    // Security Settings
    requireConfirmation: true,
    logAllActivity: true,
    autoBackup: true,
    
    // Rate Limiting
    globalRateLimit: 300,
    rateLimitWindow: 60,
    
    // Google Cloud Functions
    googleCloudFunctions: {
      enabled: false,
      functionUrl: '',
      projectId: '',
      region: 'us-central1',
      functionName: 'sendEmailCampaign',
      defaultRateLimit: 3600,
      defaultBatchSize: 10
    }
  });

  // Load settings on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('emailCampaignSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('emailCampaignSettings', JSON.stringify(settings));
    console.log('Saving settings:', settings);
    toast({
      title: "Settings Saved",
      description: "Your configuration has been updated successfully"
    });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateGoogleCloudSettings = (gcfConfig: any) => {
    setSettings(prev => ({
      ...prev,
      googleCloudFunctions: gcfConfig
    }));
  };

  const handleGoogleCloudTest = async (gcfConfig: any): Promise<boolean> => {
    try {
      if (!gcfConfig.functionUrl) {
        throw new Error('Function URL is required');
      }
      
      const response = await fetch(gcfConfig.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Google Cloud test error:', error);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Application Settings</h2>
          <p className="text-slate-600">Configure your email campaign application preferences</p>
        </div>
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="cloud" className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Cloud Functions
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Setup Guide
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Email Settings</CardTitle>
              <CardDescription>
                Set default values for new email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultFromName">Default From Name</Label>
                <Input
                  id="defaultFromName"
                  value={settings.defaultFromName}
                  onChange={(e) => updateSetting('defaultFromName', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="defaultSignature">Default Email Signature</Label>
                <Textarea
                  id="defaultSignature"
                  placeholder="Enter your default email signature..."
                  value={settings.defaultSignature}
                  onChange={(e) => updateSetting('defaultSignature', e.target.value)}
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxRecipients">Max Recipients Per Batch</Label>
                <Input
                  id="maxRecipients"
                  type="number"
                  value={settings.maxRecipientsPerBatch}
                  onChange={(e) => updateSetting('maxRecipientsPerBatch', parseInt(e.target.value))}
                />
                <p className="text-sm text-slate-500">
                  Large batches will be automatically split into smaller groups
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>
                Configure global rate limits for email sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="globalRateLimit">Emails Per Window</Label>
                  <Input
                    id="globalRateLimit"
                    type="number"
                    value={settings.globalRateLimit}
                    onChange={(e) => updateSetting('globalRateLimit', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimitWindow">Window (seconds)</Label>
                  <Input
                    id="rateLimitWindow"
                    type="number"
                    value={settings.rateLimitWindow}
                    onChange={(e) => updateSetting('rateLimitWindow', parseInt(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Global limit: {settings.globalRateLimit} emails per {settings.rateLimitWindow} seconds
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Google Gemini AI
              </CardTitle>
              <CardDescription>
                Configure AI features for subject line generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  placeholder="Enter your Google Gemini API key"
                  value={settings.geminiApiKey}
                  onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                />
                <p className="text-sm text-slate-500">
                  Get your API key from the Google AI Studio
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Setup Instructions:</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Visit Google AI Studio (aistudio.google.com)</li>
                  <li>2. Create a new project or select existing one</li>
                  <li>3. Generate an API key for Gemini</li>
                  <li>4. Paste the key above and save settings</li>
                </ol>
              </div>
              
              {settings.geminiApiKey && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    API Key Configured
                  </Badge>
                  <span className="text-sm text-slate-600">AI features enabled</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloud" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                Global Google Cloud Functions Configuration
              </CardTitle>
              <CardDescription>
                Set up Google Cloud Functions once and use across all campaigns for high-speed email sending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GlobalGoogleCloudConfig
                config={settings.googleCloudFunctions}
                onSave={updateGoogleCloudSettings}
                onTest={handleGoogleCloudTest}
              />
              
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Benefits of Global Configuration:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>✅ Configure once, use for all campaigns</p>
                  <p>✅ Automatic rate limiting and batch processing</p>
                  <p>✅ Supports both SMTP and Apps Script accounts</p>
                  <p>✅ Handles 1000+ emails efficiently</p>
                  <p>✅ Real-time progress tracking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          <GoogleCloudSetupGuide />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose when and how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-slate-500">
                    Receive email updates about campaign status
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Success Notifications</Label>
                  <p className="text-sm text-slate-500">
                    Get notified when campaigns complete successfully
                  </p>
                </div>
                <Switch
                  checked={settings.successNotifications}
                  onCheckedChange={(checked) => updateSetting('successNotifications', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Error Notifications</Label>
                  <p className="text-sm text-slate-500">
                    Get notified when campaigns fail or encounter errors
                  </p>
                </div>
                <Switch
                  checked={settings.errorNotifications}
                  onCheckedChange={(checked) => updateSetting('errorNotifications', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>
                Configure security settings and data handling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Require Confirmation</Label>
                  <p className="text-sm text-slate-500">
                    Require confirmation before sending campaigns
                  </p>
                </div>
                <Switch
                  checked={settings.requireConfirmation}
                  onCheckedChange={(checked) => updateSetting('requireConfirmation', checked)}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Log All Activity</Label>
                  <p className="text-sm text-slate-500">
                    Keep detailed logs of all email sending activity
                  </p>
                </div>
                <Switch
                  checked={settings.logAllActivity}
                  onCheckedChange={(checked) => updateSetting('logAllActivity', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Automatic Backup</Label>
                  <p className="text-sm text-slate-500">
                    Automatically backup account configurations and settings
                  </p>
                </div>
                <Switch
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPanel;
