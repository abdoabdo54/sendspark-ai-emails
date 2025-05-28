
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EmailComposer from "@/components/EmailComposer";
import AccountManager from "@/components/AccountManager";
import CampaignHistory from "@/components/CampaignHistory";
import SettingsPanel from "@/components/SettingsPanel";
import SubscriberManager from "@/components/SubscriberManager";
import DashboardStats from "@/components/DashboardStats";
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Mail, Settings, History, Users, Building2, LogOut, ChevronDown } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();
  const { organizations, currentOrganization, switchOrganization } = useOrganizations();
  const [activeTab, setActiveTab] = useState("compose");

  const currentUserRole = organizations.find(org => org.organization.id === currentOrganization?.id)?.role;

  const getUserInitials = () => {
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Email Campaign Pro
            </h1>
            <p className="text-slate-600">
              Professional multi-tenant email marketing platform
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Organization Selector */}
            <Select 
              value={currentOrganization?.id} 
              onValueChange={(orgId) => {
                const org = organizations.find(o => o.organization.id === orgId)?.organization;
                if (org) switchOrganization(org);
              }}
            >
              <SelectTrigger className="w-64">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span>{currentOrganization?.name}</span>
                </div>
                <ChevronDown className="w-4 h-4" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.organization.id} value={org.organization.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{org.organization.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {org.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Plan Badge */}
        {currentOrganization && (
          <div className="mb-6">
            <Badge variant="outline" className="text-sm">
              {currentOrganization.subscription_plan.charAt(0).toUpperCase() + currentOrganization.subscription_plan.slice(1)} Plan
              <span className="ml-2 text-xs">
                {currentOrganization.emails_sent_this_month.toLocaleString()}/{currentOrganization.monthly_email_limit.toLocaleString()} emails used
              </span>
            </Badge>
          </div>
        )}

        {/* Dashboard Stats */}
        <DashboardStats />

        {/* Main Interface */}
        <Card className="mt-6">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Campaign Management</CardTitle>
            <CardDescription className="text-blue-100">
              Create, manage, and send professional email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-white border-b">
                <TabsTrigger 
                  value="compose" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Mail className="w-4 h-4" />
                  Compose
                </TabsTrigger>
                <TabsTrigger 
                  value="subscribers" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Users className="w-4 h-4" />
                  Subscribers
                </TabsTrigger>
                <TabsTrigger 
                  value="accounts" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                  disabled={!['org_admin', 'super_admin'].includes(currentUserRole || '')}
                >
                  <Building2 className="w-4 h-4" />
                  Accounts
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                  disabled={!['org_admin', 'super_admin'].includes(currentUserRole || '')}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="p-6">
                <EmailComposer />
              </TabsContent>

              <TabsContent value="subscribers" className="p-6">
                <SubscriberManager />
              </TabsContent>

              <TabsContent value="accounts" className="p-6">
                <AccountManager />
              </TabsContent>

              <TabsContent value="history" className="p-6">
                <CampaignHistory />
              </TabsContent>

              <TabsContent value="settings" className="p-6">
                <SettingsPanel />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
