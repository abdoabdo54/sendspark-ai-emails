
import React, { useState, useMemo } from 'react';
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
    pauseCampaign, 
    resumeCampaign,
    duplicateCampaign 
  } = useCampaigns(currentOrganization?.id);
  const [searchTerm, setSearchTerm] = useState('');

  // Memoize filtered campaigns to prevent unnecessary re-renders
  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    return campaigns.filter(campaign =>
      campaign.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.from_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [campaigns, searchTerm]);

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

  // Memoized handlers to prevent re-renders
  const handleDelete = React.useCallback(async (campaignId: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      try {
        await deleteCampaign(campaignId);
      } catch (error) {
        console.error('Error deleting campaign:', error);
      }
    }
  }, [deleteCampaign]);

  const handleDuplicate = React.useCallback(async (campaignId: string) => {
    try {
      await duplicateCampaign(campaignId);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
    }
  }, [duplicateCampaign]);

  const handlePause = React.useCallback(async (campaignId: string) => {
    try {
      await pauseCampaign(campaignId);
    } catch (error) {
      console.error('Error pausing campaign:', error);
    }
  }, [pauseCampaign]);

  const handleResume = React.useCallback(async (campaignId: string) => {
    try {
      await resumeCampaign(campaignId);
    } catch (error) {
      console.error('Error resuming campaign:', error);
    }
  }, [resumeCampaign]);

  const handleEdit = React.useCallback((campaign: any) => {
    localStorage.setItem('editCampaign', JSON.stringify(campaign));
    navigate('/');
  }, [navigate]);

  const handleViewAnalytics = React.useCallback((campaignId: string) => {
    console.log('View analytics for campaign:', campaignId);
  }, []);

  const handleCreateCampaign = React.useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Show organization loading state
  if (!currentOrganization && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header activeTab="campaigns" />
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Organization Selected</h3>
            <p className="text-slate-600">Please select an organization to view campaigns.</p>
          </div>
        </div>
      </div>
    );
  }

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
                <CampaignListItem
                  key={campaign.id}
                  campaign={campaign}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onPause={handlePause}
                  onResume={handleResume}
                  onEdit={handleEdit}
                  onViewAnalytics={handleViewAnalytics}
                  getStatusColor={getStatusColor}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoized campaign list item component to prevent unnecessary re-renders
const CampaignListItem = React.memo(({ 
  campaign, 
  onDelete, 
  onDuplicate, 
  onPause, 
  onResume, 
  onEdit, 
  onViewAnalytics,
  getStatusColor,
  formatDate
}: any) => (
  <div className="p-4 hover:bg-gray-50 transition-colors">
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
        {/* Action buttons with conditional rendering */}
        {campaign.status === 'sending' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onPause(campaign.id)}
            title="Pause Campaign"
          >
            <Pause className="w-4 h-4" />
          </Button>
        )}

        {campaign.status === 'paused' && (
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onResume(campaign.id)}
            title="Resume Campaign"
          >
            <Play className="w-4 h-4" />
          </Button>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onViewAnalytics(campaign.id)}
          title="View Analytics"
        >
          <BarChart3 className="w-4 h-4" />
        </Button>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDuplicate(campaign.id)}
          title="Duplicate Campaign"
        >
          <Copy className="w-4 h-4" />
        </Button>

        {campaign.status === 'draft' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit(campaign)}
            title="Edit Campaign"
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDelete(campaign.id)}
          title="Delete Campaign"
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
));

export default Campaigns;
