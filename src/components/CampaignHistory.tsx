
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Mail, Users, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'completed' | 'failed' | 'pending' | 'sending';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string;
  sendMethod: string;
}

const CampaignHistory = () => {
  const [campaigns] = useState<Campaign[]>([
    {
      id: '1',
      name: 'Monthly Newsletter',
      subject: 'Your Monthly Update - December 2024',
      status: 'completed',
      recipientCount: 1500,
      sentCount: 1485,
      failedCount: 15,
      createdAt: '2024-12-01T10:00:00Z',
      completedAt: '2024-12-01T10:30:00Z',
      sendMethod: 'Google Apps Script'
    },
    {
      id: '2',
      name: 'Product Launch',
      subject: 'Introducing Our New Feature',
      status: 'sending',
      recipientCount: 800,
      sentCount: 450,
      failedCount: 5,
      createdAt: '2024-12-02T14:00:00Z',
      sendMethod: 'PowerMTA SMTP'
    },
    {
      id: '3',
      name: 'Welcome Series',
      subject: 'Welcome to Our Platform!',
      status: 'failed',
      recipientCount: 200,
      sentCount: 50,
      failedCount: 150,
      createdAt: '2024-12-01T16:00:00Z',
      completedAt: '2024-12-01T16:15:00Z',
      sendMethod: 'Generic SMTP'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'sending': return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      sending: 'secondary',
      pending: 'outline'
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
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
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
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
                    <p className="text-xl font-bold">{campaign.recipientCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Sent</span>
                    </div>
                    <p className="text-xl font-bold text-green-600">{campaign.sentCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">Failed</span>
                    </div>
                    <p className="text-xl font-bold text-red-600">{campaign.failedCount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Success Rate</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">
                      {getSuccessRate(campaign.sentCount, campaign.recipientCount)}%
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <div>
                    <span className="font-medium">Method:</span> {campaign.sendMethod}
                  </div>
                  <div>
                    <span className="font-medium">Started:</span> {formatDate(campaign.createdAt)}
                    {campaign.completedAt && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Completed:</span> {formatDate(campaign.completedAt)}
                      </>
                    )}
                  </div>
                </div>

                {campaign.status === 'sending' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                      <span>Progress</span>
                      <span>{((campaign.sentCount / campaign.recipientCount) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.sentCount / campaign.recipientCount) * 100}%` }}
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
