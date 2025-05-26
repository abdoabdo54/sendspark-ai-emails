
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useCampaigns } from '@/hooks/useCampaigns';

const DashboardStats = () => {
  const { accounts, loading: accountsLoading } = useEmailAccounts();
  const { campaigns, loading: campaignsLoading } = useCampaigns();

  const loading = accountsLoading || campaignsLoading;

  const stats = [
    {
      title: "Total Campaigns",
      value: campaigns.length.toString(),
      icon: Mail,
      trend: `+${campaigns.filter(c => new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}`,
      color: "text-blue-600"
    },
    {
      title: "Active Accounts",
      value: accounts.filter(a => a.is_active).length.toString(),
      icon: Users,
      trend: `${accounts.length} total`,
      color: "text-green-600"
    },
    {
      title: "Emails Sent",
      value: campaigns.reduce((sum, c) => sum + c.sent_count, 0).toLocaleString(),
      icon: CheckCircle,
      trend: `${campaigns.reduce((sum, c) => sum + c.total_recipients, 0).toLocaleString()} total`,
      color: "text-purple-600"
    },
    {
      title: "Sending",
      value: campaigns.filter(c => c.status === 'sending').length.toString(),
      icon: Clock,
      trend: `${campaigns.filter(c => c.status === 'draft').length} drafts`,
      color: "text-orange-600"
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="text-slate-600">
                  {stat.trend}
                </span> from last month
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardStats;
