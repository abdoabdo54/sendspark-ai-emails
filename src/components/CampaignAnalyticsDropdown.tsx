
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Eye, MousePointer, UserMinus, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CampaignAnalyticsDropdownProps {
  campaignId: string;
  campaignName: string;
}

interface AnalyticsData {
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  unsubscribes: number;
  delivered: number;
}

const CampaignAnalyticsDropdown: React.FC<CampaignAnalyticsDropdownProps> = ({ 
  campaignId, 
  campaignName 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    opens: 0,
    uniqueOpens: 0,
    clicks: 0,
    uniqueClicks: 0,
    unsubscribes: 0,
    delivered: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      // Fetch from campaign_stats table
      const { data: stats } = await supabase
        .from('campaign_stats')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();

      if (stats) {
        setAnalytics({
          opens: stats.opens || 0,
          uniqueOpens: stats.unique_opens || 0,
          clicks: stats.clicks || 0,
          uniqueClicks: stats.unique_clicks || 0,
          unsubscribes: stats.unsubscribes || 0,
          delivered: stats.delivered || 0
        });
      } else {
        // If no stats exist, count from analytics events
        const { data: openEvents } = await supabase
          .from('campaign_analytics')
          .select('subscriber_id')
          .eq('campaign_id', campaignId)
          .eq('event_type', 'open');

        const { data: clickEvents } = await supabase
          .from('campaign_analytics')
          .select('subscriber_id')
          .eq('campaign_id', campaignId)
          .eq('event_type', 'click');

        const { data: unsubEvents } = await supabase
          .from('campaign_analytics')
          .select('subscriber_id')
          .eq('campaign_id', campaignId)
          .eq('event_type', 'unsubscribe');

        const uniqueOpens = new Set(openEvents?.map(e => e.subscriber_id) || []).size;
        const uniqueClicks = new Set(clickEvents?.map(e => e.subscriber_id) || []).size;

        setAnalytics({
          opens: openEvents?.length || 0,
          uniqueOpens,
          clicks: clickEvents?.length || 0,
          uniqueClicks,
          unsubscribes: unsubEvents?.length || 0,
          delivered: 0
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [isOpen, campaignId]);

  const StatCard = ({ icon: Icon, label, value, color }: { 
    icon: any, 
    label: string, 
    value: number, 
    color: string 
  }) => (
    <div className={`p-3 rounded-lg border ${color}`}>
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between p-0 h-auto font-normal"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-sm text-slate-600">
            View analytics for "{campaignName}"
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading analytics...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard 
                  icon={Mail}
                  label="Delivered"
                  value={analytics.delivered}
                  color="bg-blue-50 border-blue-200"
                />
                <StatCard 
                  icon={Eye}
                  label="Opens"
                  value={analytics.opens}
                  color="bg-green-50 border-green-200"
                />
                <StatCard 
                  icon={Eye}
                  label="Unique Opens"
                  value={analytics.uniqueOpens}
                  color="bg-green-50 border-green-200"
                />
                <StatCard 
                  icon={MousePointer}
                  label="Clicks"
                  value={analytics.clicks}
                  color="bg-purple-50 border-purple-200"
                />
                <StatCard 
                  icon={MousePointer}
                  label="Unique Clicks"
                  value={analytics.uniqueClicks}
                  color="bg-purple-50 border-purple-200"
                />
                <StatCard 
                  icon={UserMinus}
                  label="Unsubscribes"
                  value={analytics.unsubscribes}
                  color="bg-red-50 border-red-200"
                />
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Open Rate: </span>
                  {analytics.delivered > 0 
                    ? `${((analytics.uniqueOpens / analytics.delivered) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
                <div>
                  <span className="font-medium">Click Rate: </span>
                  {analytics.uniqueOpens > 0 
                    ? `${((analytics.uniqueClicks / analytics.uniqueOpens) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CampaignAnalyticsDropdown;
