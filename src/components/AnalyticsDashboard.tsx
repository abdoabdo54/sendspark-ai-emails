
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Mail, Users, Target, Calendar } from 'lucide-react';
import { useOrganizations } from '@/hooks/useOrganizations';

const AnalyticsDashboard = () => {
  const { currentOrganization } = useOrganizations();

  if (!currentOrganization) return null;

  const emailUsagePercentage = (currentOrganization.emails_sent_this_month / currentOrganization.monthly_email_limit) * 100;
  const remainingEmails = currentOrganization.monthly_email_limit - currentOrganization.emails_sent_this_month;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currentOrganization.emails_sent_this_month.toLocaleString()}</div>
          <div className="space-y-2 mt-2">
            <Progress value={emailUsagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {remainingEmails.toLocaleString()} remaining this month
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">{currentOrganization.subscription_plan}</div>
          <div className="flex items-center space-x-2 mt-2">
            <Badge variant={currentOrganization.subscription_plan === 'pro' ? 'default' : 'secondary'}>
              {currentOrganization.monthly_email_limit.toLocaleString()}/month
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Organization</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currentOrganization.name}</div>
          <div className="flex items-center space-x-2 mt-2">
            <Badge variant={currentOrganization.is_active ? 'default' : 'secondary'}>
              {currentOrganization.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(emailUsagePercentage)}%
          </div>
          <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-2">
            {emailUsagePercentage > 75 ? (
              <>
                <TrendingUp className="h-3 w-3 text-red-500" />
                <span className="text-red-500">High usage</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Good usage</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
