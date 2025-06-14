import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap
} from 'lucide-react';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useClientCampaignPreparation } from '@/hooks/useClientCampaignPreparation';
import Header from '@/components/Header';
import { toast } from 'sonner';

const Campaigns = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { 
    campaigns, 
    loading, 
    pagination,
    searchTerm,
    deleteCampaign, 
    pauseCampaign, 
    resumeCampaign,
    duplicateCampaign,
    nextPage,
    prevPage,
    search,
    refetch
  } = useCampaigns(currentOrganization?.id);

  const { sendCampaign: dispatchCampaign } = useCampaignSender(currentOrganization?.id);
  const { prepareCampaignClientSide } = useClientCampaignPreparation();

  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [sortBy, setSortBy] = useState('created_at');
  const [preparingCampaigns, setPreparingCampaigns] = useState<Set<string>>(new Set());
  const [sendingCampaigns, setSendingCampaigns] = useState<Set<string>>(new Set());

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setLocalSearchTerm(value);
    // Debounce search
    setTimeout(() => {
      search(value);
    }, 500);
  };

  // Memoized sorted campaigns
  const sortedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    return [...campaigns].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.subject.localeCompare(b.subject);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'recipients':
          return (b.total_recipients || 0) - (a.total_recipients || 0);
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [campaigns, sortBy]);

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

  const handleAction = async (action: string, campaignId: string) => {
    try {
      switch (action) {
        case 'prepare':
          console.log('🔧 Starting campaign preparation:', campaignId);
          setPreparingCampaigns(prev => new Set([...prev, campaignId]));
          
          try {
            const result = await prepareCampaignClientSide(campaignId);
            console.log('✅ Campaign preparation completed:', result);
            toast.success(`Campaign prepared successfully with ${result.emailCount} emails!`);
            
            // Refresh campaigns
            setTimeout(() => {
              refetch();
            }, 2000);
            
          } catch (error: any) {
            console.error('❌ Campaign preparation failed:', error);
            toast.error(`Preparation failed: ${error.message}`);
          } finally {
            setPreparingCampaigns(prev => {
              const newSet = new Set(prev);
              newSet.delete(campaignId);
              return newSet;
            });
          }
          break;
          
        case 'send':
          const sendCampaign = campaigns.find(c => c.id === campaignId);
          if (!sendCampaign) {
            throw new Error('Campaign not found');
          }

          // Check if campaign is prepared
          if (sendCampaign.status !== 'prepared') {
            toast.error(`Campaign must be prepared before sending. Current status: ${sendCampaign.status}`);
            return;
          }

          // Check if accounts are selected
          if (!sendCampaign.config?.selectedAccounts?.length) {
            toast.error('No accounts selected for this campaign. Please edit and select accounts.');
            return;
          }
          
          console.log('🚀 Starting campaign send:', {
            id: campaignId,
            status: sendCampaign.status,
            preparedEmails: sendCampaign.prepared_emails?.length || 0,
            selectedAccounts: sendCampaign.config?.selectedAccounts?.length || 0
          });
          
          setSendingCampaigns(prev => new Set([...prev, campaignId]));
          
          try {
            await dispatchCampaign({
              from_name: sendCampaign.from_name,
              subject: sendCampaign.subject,
              recipients: sendCampaign.recipients,
              html_content: sendCampaign.html_content,
              text_content: sendCampaign.text_content,
              send_method: sendCampaign.send_method,
              config: sendCampaign.config
            });
            
            console.log('✅ Campaign sent successfully!');
            
            // Refresh campaigns
            setTimeout(() => {
              refetch();
            }, 1000);
            
          } finally {
            setSendingCampaigns(prev => {
              const newSet = new Set(prev);
              newSet.delete(campaignId);
              return newSet;
            });
          }
          break;
          
        case 'delete':
          if (confirm('Are you sure you want to delete this campaign?')) {
            await deleteCampaign(campaignId);
          }
          break;
          
        case 'duplicate':
          await duplicateCampaign(campaignId);
          break;
          
        case 'pause':
          await pauseCampaign(campaignId);
          break;
          
        case 'resume':
          await resumeCampaign(campaignId);
          break;
      }
    } catch (error) {
      console.error('❌ Action failed:', error);
      toast.error(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Remove from tracking on error
      setSendingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
      setPreparingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

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
          <p className="text-slate-600">
            Manage and monitor your email campaigns ({pagination.totalCount} total)
          </p>
        </div>

        {/* Search, Sort and Create Section */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or subject..."
                  value={localSearchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Created</SelectItem>
                  <SelectItem value="name">Campaign Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="recipients">Recipients</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold">
                  Campaigns (Page {pagination.currentPage} of {pagination.totalPages})
                </h2>
              </div>
              
              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevPage}
                    disabled={!pagination.hasPrev}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-slate-600 px-2">
                    {pagination.currentPage} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextPage}
                    disabled={!pagination.hasNext}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-slate-600">Loading campaigns...</span>
              </div>
            ) : sortedCampaigns.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No campaigns found</h3>
                <p className="text-slate-600 mb-4">
                  {localSearchTerm ? 'No campaigns match your search.' : 'Create your first email campaign to get started.'}
                </p>
                <Button onClick={handleCreateCampaign}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </div>
            ) : (
              sortedCampaigns.map((campaign) => (
                <CampaignListItem
                  key={campaign.id}
                  campaign={campaign}
                  onAction={handleAction}
                  onEdit={handleEdit}
                  onViewAnalytics={handleViewAnalytics}
                  getStatusColor={getStatusColor}
                  formatDate={formatDate}
                  isPrepairing={preparingCampaigns.has(campaign.id)}
                  isSending={sendingCampaigns.has(campaign.id)}
                />
              ))
            )}
          </div>

          {/* Bottom Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {((pagination.currentPage - 1) * 8) + 1} to {Math.min(pagination.currentPage * 8, pagination.totalCount)} of {pagination.totalCount} campaigns
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevPage}
                    disabled={!pagination.hasPrev}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextPage}
                    disabled={!pagination.hasNext}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoized campaign list item component
const CampaignListItem = React.memo(({ 
  campaign, 
  onAction, 
  onEdit, 
  onViewAnalytics,
  getStatusColor,
  formatDate,
  isPrepairing,
  isSending
}: any) => (
  <div className="p-4 hover:bg-gray-50 transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-medium text-slate-900">{campaign.subject}</h3>
          <Badge className={`text-xs ${getStatusColor(campaign.status)}`}>
            {campaign.status}
          </Badge>
          {campaign.status === 'prepared' && (
            <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
              Ready to Send
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-6 text-sm text-slate-600 mb-3">
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

        {/* Show preparation status */}
        {campaign.status === 'prepared' && campaign.prepared_emails?.length > 0 && (
          <div className="text-xs text-green-600 mb-2">
            ✅ {campaign.prepared_emails.length} emails prepared and ready to send
          </div>
        )}

        {/* Campaign configuration display */}
        {campaign.config && (
          <div className="text-xs text-slate-500 mb-3 space-y-1">
            <div className="flex gap-4 flex-wrap">
              <span>📧 Accounts: {campaign.config.selectedAccounts?.length || 0} selected</span>
              <span>⚡ Mode: {
                campaign.config.sendingMode === 'zero-delay' ? '🚀 ZERO DELAY' :
                campaign.config.sendingMode === 'fast' ? 'Fast (0.5s delay)' :
                campaign.config.sendingMode === 'controlled' ? 'Controlled (2s delay)' :
                campaign.config.sendingMode || 'controlled'
              }</span>
              <span>🔄 Method: {
                campaign.config.dispatchMethod === 'parallel' ? 'Parallel Distribution' :
                campaign.config.dispatchMethod === 'round-robin' ? 'Round Robin' :
                campaign.config.dispatchMethod === 'sequential' ? 'Sequential' :
                campaign.config.dispatchMethod || 'parallel'
              }</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {/* Prepare Button - show for draft campaigns */}
        {campaign.status === 'draft' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('prepare', campaign.id)}
            disabled={isPrepairing}
            className="flex items-center gap-1"
          >
            <Clock className="w-4 h-4" />
            {isPrepairing ? 'Preparing...' : 'Prepare'}
          </Button>
        )}
        
        {/* Send Button - show for prepared campaigns */}
        {campaign.status === 'prepared' && (
          <Button
            size="sm"
            onClick={() => onAction('send', campaign.id)}
            disabled={isSending}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
          >
            <Zap className="w-4 h-4" />
            {isSending ? 'Sending...' : 'Send Now'}
          </Button>
        )}
        
        {/* Pause/Resume for sending campaigns */}
        {campaign.status === 'sending' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onAction('pause', campaign.id)}
            title="Pause Campaign"
          >
            <Pause className="w-4 h-4" />
          </Button>
        )}

        {campaign.status === 'paused' && (
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onAction('resume', campaign.id)}
            title="Resume Campaign"
          >
            <Play className="w-4 h-4" />
          </Button>
        )}

        {/* Analytics Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onViewAnalytics(campaign.id)}
          title="View Analytics"
        >
          <BarChart3 className="w-4 h-4" />
        </Button>

        {/* Duplicate Button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onAction('duplicate', campaign.id)}
          title="Duplicate Campaign"
        >
          <Copy className="w-4 h-4" />
        </Button>

        {/* Edit Button - for draft campaigns */}
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

        {/* Delete Button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onAction('delete', campaign.id)}
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
