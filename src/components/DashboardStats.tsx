
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, CheckCircle, Clock } from 'lucide-react';

const DashboardStats = () => {
  const stats = [
    {
      title: "Total Campaigns",
      value: "24",
      icon: Mail,
      trend: "+12%",
      color: "text-blue-600"
    },
    {
      title: "Active Accounts",
      value: "8",
      icon: Users,
      trend: "+2",
      color: "text-green-600"
    },
    {
      title: "Emails Sent",
      value: "15,420",
      icon: CheckCircle,
      trend: "+1,234",
      color: "text-purple-600"
    },
    {
      title: "Pending",
      value: "127",
      icon: Clock,
      trend: "-45",
      color: "text-orange-600"
    }
  ];

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
                <span className={stat.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
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
