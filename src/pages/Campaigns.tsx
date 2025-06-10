
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  Mail, 
  Users, 
  BarChart3,
  Copy,
  Edit,
  Trash2,
  Send,
  Settings,
  Play,
  Pause
} from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import Header from '@/components/Header';

const Campaigns = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { 
    campaigns, 
    loading, 
    deleteCampaign, 
    prepareCampaign, 
    sendCampaign, 
    pauseCampaign, 
    resumeCampaign,
    duplicateCampaign 
  } = useCampaigns(currentOrganization?.id);
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
      case 'prepared':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'paused':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
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

  const handleDelete = async (campaignId: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      try {
        await deleteCampaign(campaignId);
      } catch (error) {
        console.error('Error deleting campaign:', error);
      }
    }
  };

  const handleDuplicate = async (campaignId: string) => {
    try {
      await duplicateCampaign(campaignId);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
    }
  };

  const handlePrepare = async (campaignId: string) => {
    try {
      await prepareCampaign(campaignId);
    } catch (error) {
      console.error('Error preparing campaign:', error);
    }
  };

  const handleSend = async (campaignId: string) => {
    try {
      await sendCampaign(campaignId);
    } catch (error) {
      console.error('Error sending campaign:', error);
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      await pauseCampaign(campaignId);
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  };

  const handleResume = async (campaignId: string) => {
    try {
      await resumeCampaign(campaignId);
    } catch (error) {
      console.error('Error resuming campaign:', error);
    }
  };

  const handleEdit = (campaign: any) => {
    localStorage.setItem('editCampaign', JSON.stringify(campaign));
    navigate('/');
  };

  const handleViewAnalytics = (campaignId: string) => {
    console.log('View analytics for campaign:', campaignId);
    // This would typically open an analytics modal or navigate to an analytics page
  };

  const handleCreateCampaign = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeTab="campaigns" />
      
      <div className="container mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Email Campaigns</h1>
          <p className="text-slate-600">Manage and monitor your email campaigns</p>
        </div>

        {/* Search and Create Section */}
        <div className="bg-white rounded-lg border p-4 mb-6">
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
            <Button 
              onClick={handleCreateCampaign} 
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Campaigns List Section */}
        <div className="bg-white rounded-lg border">
          <div className="border-b p-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold">All Campaigns ({filteredCampaigns.length})</h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">View and manage your email campaigns</p>
          </div>

          <div className="divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-slate-600">Loading campaigns...</span>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No campaigns found</h3>
                <p className="text-slate-600 mb-4">
                  {searchTerm ? 'No campaigns match your search.' : 'Create your first email campaign to get started.'}
                </p>
                <Button onClick={handleCreateCampaign}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-slate-900">{campaign.subject}</h3>
                        <Badge className={`text-xs ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>From: {campaign.from_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>Recipients: {campaign.total_recipients || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Send className="w-4 h-4" />
                          <span>Sent: {campaign.sent_count || 0}</span>
                        </div>
                        <div className="text-slate-500">
                          {campaign.sent_at ? formatDate(campaign.sent_at) : formatDate(campaign.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Prepare Button - only for draft campaigns */}
                      {campaign.status === 'draft' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePrepare(campaign.id)}
                          title="Prepare Campaign"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Send Button - for prepared campaigns */}
                      {campaign.status === 'prepared' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleSend(campaign.id)}
                          title="Send Campaign"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Pause Button - for sending campaigns */}
                      {campaign.status === 'sending' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePause(campaign.id)}
                          title="Pause Campaign"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Resume Button - for paused campaigns */}
                      {campaign.status === 'paused' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleResume(campaign.id)}
                          title="Resume Campaign"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Analytics Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewAnalytics(campaign.id)}
                        title="View Analytics"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>

                      {/* Duplicate Button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDuplicate(campaign.id)}
                        title="Duplicate Campaign"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      {/* Edit Button - only for draft campaigns */}
                      {campaign.status === 'draft' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(campaign)}
                          title="Edit Campaign"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Delete Button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                        title="Delete Campaign"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
