
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  Mail, 
  Calendar, 
  Users, 
  BarChart3,
  Eye,
  Edit,
  Trash2,
  Send
} from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import Header from '@/components/Header';

const Campaigns = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { campaigns, loading } = useCampaigns(currentOrganization?.id);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCampaigns = campaigns?.filter(campaign =>
    campaign.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.from_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'sending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <Header />
      
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Email Campaigns</h1>
          <p className="text-slate-600">Manage and monitor your email campaigns</p>
        </div>

        {/* Search and Actions */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => window.location.href = '/'} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Campaign
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              All Campaigns ({filteredCampaigns.length})
            </CardTitle>
            <CardDescription>
              View and manage your email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-slate-600">Loading campaigns...</p>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No campaigns found</h3>
                <p className="text-slate-600 mb-4">
                  {searchTerm ? 'No campaigns match your search.' : 'Create your first email campaign to get started.'}
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-slate-900">{campaign.subject}</h3>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            From: {campaign.from_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            Recipients: {campaign.total_recipients || 0}
                          </div>
                          <div className="flex items-center gap-1">
                            <Send className="w-4 h-4" />
                            Sent: {campaign.sent_count || 0}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {campaign.sent_at ? formatDate(campaign.sent_at) : formatDate(campaign.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        {campaign.status === 'draft' && (
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Campaigns;
