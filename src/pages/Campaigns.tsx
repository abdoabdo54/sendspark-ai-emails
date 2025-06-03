
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, Copy, Trash2, BarChart3, Users, Mail, Calendar, TestTube } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';

const Campaigns = () => {
  const { campaigns, loading } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <Play className="w-4 h-4 text-blue-600" />;
      case 'sending': return <Pause className="w-4 h-4 text-green-600" />;
      case 'sent': return <Mail className="w-4 h-4 text-slate-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-orange-600" />;
      case 'failed': return <Trash2 className="w-4 h-4 text-red-600" />;
      default: return <Mail className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      ready: 'secondary',
      sending: 'default',
      sent: 'outline',
      paused: 'secondary',
      failed: 'destructive'
    };
    return variants[status as keyof typeof variants] || 'outline';
  };

  const getProgress = (campaign: any) => {
    if (campaign.total_recipients === 0) return 0;
    return (campaign.sent_count / campaign.total_recipients) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Campaign Management
          </h1>
          <p className="text-slate-600 text-lg">
            Manage, monitor, and control your email campaigns
          </p>
        </div>

        {/* Campaign Grid */}
        <div className="grid gap-6">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No campaigns found</h3>
                <p className="text-slate-500 text-center mb-4">
                  Create your first email campaign to see it here
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(campaign.status)}
                      <div>
                        <CardTitle className="text-xl">{campaign.from_name}</CardTitle>
                        <CardDescription className="text-base">{campaign.subject}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadge(campaign.status) as any} className="text-sm">
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {campaign.send_method.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium">Recipients</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{campaign.total_recipients.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm font-medium">Sent</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{campaign.sent_count.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm font-medium">Progress</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{getProgress(campaign).toFixed(1)}%</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Created</span>
                      </div>
                      <p className="text-sm font-bold text-purple-600">{formatDate(campaign.created_at)}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {campaign.status === 'sending' && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Sending Progress</span>
                        <span>{getProgress(campaign).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${getProgress(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {campaign.status === 'ready' && (
                      <Button className="flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Resume
                      </Button>
                    )}
                    
                    {campaign.status === 'sending' && (
                      <Button variant="outline" className="flex items-center gap-2">
                        <Pause className="w-4 h-4" />
                        Pause
                      </Button>
                    )}
                    
                    <Button variant="outline" className="flex items-center gap-2">
                      <TestTube className="w-4 h-4" />
                      Test
                    </Button>
                    
                    <Button variant="outline" className="flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>
                    
                    <Button variant="outline" className="flex items-center gap-2 text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>

                  {/* Campaign Details */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Method:</span> {campaign.send_method}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {formatDate(campaign.created_at)}
                      </div>
                      {campaign.sent_at && (
                        <div>
                          <span className="font-medium">Sent:</span> {formatDate(campaign.sent_at)}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Success Rate:</span> {
                          campaign.total_recipients > 0 
                            ? ((campaign.sent_count / campaign.total_recipients) * 100).toFixed(1)
                            : '0.0'
                        }%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
