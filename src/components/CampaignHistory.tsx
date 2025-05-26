
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Mail, Users, CheckCircle, XCircle, Clock, Search, Filter, Loader2 } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';

const CampaignHistory = () => {
  const { campaigns, loading } = useCampaigns();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.from_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'sending': return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'draft': return <Clock className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      sent: 'default',
      failed: 'destructive',
      sending: 'secondary',
      draft: 'outline'
    };
    return variants[status as keyof typeof variants] || 'outline';
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

  const getSuccessRate = (sent: number, total: number) => {
    return total > 0 ? ((sent / total) * 100).toFixed(1) : '0.0';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campaign History</h2>
          <p className="text-slate-600">Track and analyze your email campaign performance</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Mail className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">No campaigns found</h3>
              <p className="text-slate-500 text-center">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Start your first email campaign to see it here'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow duration-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(campaign.status)}
                    <div>
                      <CardTitle className="text-lg">{campaign.from_name}</CardTitle>
                      <CardDescription>{campaign.subject}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={getStatusBadge(campaign.status) as any}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Recipients</span>
                    </div>
                    <p className="text-xl font-bold">{campaign.total_recipients.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Sent</span>
                    </div>
                    <p className="text-xl font-bold text-green-600">{campaign.sent_count.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">Failed</span>
                    </div>
                    <p className="text-xl font-bold text-red-600">{(campaign.total_recipients - campaign.sent_count).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Success Rate</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">
                      {getSuccessRate(campaign.sent_count, campaign.total_recipients)}%
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <div>
                    <span className="font-medium">Method:</span> {campaign.send_method}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {formatDate(campaign.created_at)}
                    {campaign.sent_at && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Sent:</span> {formatDate(campaign.sent_at)}
                      </>
                    )}
                  </div>
                </div>

                {campaign.status === 'sending' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                      <span>Progress</span>
                      <span>{((campaign.sent_count / campaign.total_recipients) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.sent_count / campaign.total_recipients) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CampaignHistory;
