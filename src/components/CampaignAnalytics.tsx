
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, Mail, Eye, MousePointer, UserX, TrendingUp, Calendar } from 'lucide-react';
import { useOrganizations } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';

interface CampaignAnalyticsData {
  campaign_id: string;
  campaign_name: string;
  sent_count: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  unique_opens: number;
  unique_clicks: number;
  delivered: number;
  spam_complaints: number;
  forwards: number;
  created_at: string;
}

interface AnalyticsEvent {
  id: string;
  campaign_id: string;
  event_type: string;
  created_at: string;
  event_data: any;
}

const CampaignAnalytics = () => {
  const { currentOrganization } = useOrganizations();
  const [analytics, setAnalytics] = useState<CampaignAnalyticsData[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');

  const fetchAnalytics = async () => {
    if (!currentOrganization) return;

    try {
      // Fetch campaign stats
      const { data: campaigns, error: campaignsError } = await supabase
        .from('email_campaigns')
        .select(`
          id,
          from_name,
          subject,
          sent_count,
          total_recipients,
          created_at,
          campaign_stats (
            opens,
            clicks,
            bounces,
            unsubscribes,
            unique_opens,
            unique_clicks,
            delivered,
            spam_complaints,
            forwards
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch analytics events
      const { data: analyticsEvents, error: eventsError } = await supabase
        .from('campaign_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;

      const analyticsData = campaigns?.map(campaign => ({
        campaign_id: campaign.id,
        campaign_name: `${campaign.from_name} - ${campaign.subject}`,
        sent_count: campaign.sent_count || 0,
        opens: campaign.campaign_stats?.[0]?.opens || 0,
        clicks: campaign.campaign_stats?.[0]?.clicks || 0,
        bounces: campaign.campaign_stats?.[0]?.bounces || 0,
        unsubscribes: campaign.campaign_stats?.[0]?.unsubscribes || 0,
        unique_opens: campaign.campaign_stats?.[0]?.unique_opens || 0,
        unique_clicks: campaign.campaign_stats?.[0]?.unique_clicks || 0,
        delivered: campaign.campaign_stats?.[0]?.delivered || campaign.sent_count || 0,
        spam_complaints: campaign.campaign_stats?.[0]?.spam_complaints || 0,
        forwards: campaign.campaign_stats?.[0]?.forwards || 0,
        created_at: campaign.created_at
      })) || [];

      setAnalytics(analyticsData);
      setEvents(analyticsEvents || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentOrganization) {
      fetchAnalytics();
    }
  }, [currentOrganization]);

  const totalStats = analytics.reduce((acc, campaign) => ({
    sent: acc.sent + campaign.sent_count,
    delivered: acc.delivered + campaign.delivered,
    opens: acc.opens + campaign.opens,
    clicks: acc.clicks + campaign.clicks,
    bounces: acc.bounces + campaign.bounces,
    unsubscribes: acc.unsubscribes + campaign.unsubscribes
  }), { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 });

  const deliveryRate = totalStats.sent > 0 ? ((totalStats.delivered / totalStats.sent) * 100).toFixed(1) : '0';
  const openRate = totalStats.delivered > 0 ? ((totalStats.opens / totalStats.delivered) * 100).toFixed(1) : '0';
  const clickRate = totalStats.delivered > 0 ? ((totalStats.clicks / totalStats.delivered) * 100).toFixed(1) : '0';
  const bounceRate = totalStats.sent > 0 ? ((totalStats.bounces / totalStats.sent) * 100).toFixed(1) : '0';

  const chartData = analytics.slice(0, 10).map(campaign => ({
    name: campaign.campaign_name.length > 30 
      ? campaign.campaign_name.substring(0, 30) + '...' 
      : campaign.campaign_name,
    sent: campaign.sent_count,
    delivered: campaign.delivered,
    opens: campaign.opens,
    clicks: campaign.clicks
  }));

  const pieData = [
    { name: 'Delivered', value: totalStats.delivered, color: '#10b981' },
    { name: 'Opens', value: totalStats.opens, color: '#3b82f6' },
    { name: 'Clicks', value: totalStats.clicks, color: '#8b5cf6' },
    { name: 'Bounces', value: totalStats.bounces, color: '#ef4444' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Campaign Analytics</h2>
        <p className="text-slate-600">Comprehensive analytics and reporting for your email campaigns</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Delivery Rate</p>
                <p className="text-3xl font-bold text-green-600">{deliveryRate}%</p>
              </div>
              <Mail className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Open Rate</p>
                <p className="text-3xl font-bold text-blue-600">{openRate}%</p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Click Rate</p>
                <p className="text-3xl font-bold text-purple-600">{clickRate}%</p>
              </div>
              <MousePointer className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Bounce Rate</p>
                <p className="text-3xl font-bold text-red-600">{bounceRate}%</p>
              </div>
              <UserX className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="events">Real-time Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    delivered: { label: "Delivered", color: "#10b981" },
                    opens: { label: "Opens", color: "#3b82f6" },
                    clicks: { label: "Clicks", color: "#8b5cf6" },
                    bounces: { label: "Bounces", color: "#ef4444" }
                  }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Campaign Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Sent</span>
                    <Badge variant="outline">{totalStats.sent.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Delivered</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {totalStats.delivered.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Opens</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {totalStats.opens.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Clicks</span>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">
                      {totalStats.clicks.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Bounces</span>
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {totalStats.bounces.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance Comparison</CardTitle>
              <CardDescription>Performance metrics for your recent campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  sent: { label: "Sent", color: "#64748b" },
                  delivered: { label: "Delivered", color: "#10b981" },
                  opens: { label: "Opens", color: "#3b82f6" },
                  clicks: { label: "Clicks", color: "#8b5cf6" }
                }}
              >
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sent" fill="#64748b" name="Sent" />
                    <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
                    <Bar dataKey="opens" fill="#3b82f6" name="Opens" />
                    <Bar dataKey="clicks" fill="#8b5cf6" name="Clicks" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Track your email performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Trend Analysis Coming Soon</h3>
                <p className="text-sm">
                  Time-based analytics and performance trends will be available here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Events</CardTitle>
              <CardDescription>Live tracking of email interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No recent events to display</p>
                  </div>
                ) : (
                  events.slice(0, 20).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <span className="text-sm text-slate-600">Campaign Event</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CampaignAnalytics;
