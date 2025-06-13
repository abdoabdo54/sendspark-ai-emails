
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Copy, 
  Trash2, 
  Settings, 
  MoreHorizontal, 
  Eye,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import CampaignEditDialog from './CampaignEditDialog';
import CampaignPreparationDialog from './CampaignPreparationDialog';
import { format } from 'date-fns';

const CampaignHistory = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { campaigns, loading, prepareCampaign, sendCampaign, deleteCampaign, duplicateCampaign } = useCampaigns(currentOrganization?.id);
  const { sendCampaign: dispatchCampaign } = useCampaignSender(currentOrganization?.id);
  
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [preparingCampaign, setPreparingCampaign] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'prepared': return 'bg-green-100 text-green-800';
      case 'sending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-emerald-100 text-emerald-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Settings className="w-3 h-3" />;
      case 'preparing': return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'prepared': return <CheckCircle2 className="w-3 h-3" />;
      case 'sending': return <Zap className="w-3 h-3" />;
      case 'sent': return <CheckCircle2 className="w-3 h-3" />;
      case 'paused': return <Pause className="w-3 h-3" />;
      case 'failed': return <AlertCircle className="w-3 h-3" />;
      default: return <Settings className="w-3 h-3" />;
    }
  };

  const handlePrepareCampaign = async (campaign: any) => {
    try {
      setPreparingCampaign(campaign.id);
      
      // Start preparation - this will show the progress dialog
      await prepareCampaign(campaign.id);
      
    } catch (error: any) {
      console.error('Failed to prepare campaign:', error);
      toast.error(`Failed to prepare campaign: ${error.message}`);
      setPreparingCampaign(null);
    }
  };

  const handleSendCampaign = async (campaign: any) => {
    if (campaign.status !== 'prepared') {
      toast.error('Campaign must be prepared before sending');
      return;
    }

    try {
      console.log('🚀 Dispatching prepared campaign:', campaign.id);
      
      const campaignData = {
        from_name: campaign.from_name,
        subject: campaign.subject,
        recipients: campaign.recipients,
        html_content: campaign.html_content,
        text_content: campaign.text_content,
        send_method: campaign.send_method,
        config: campaign.config || {}
      };

      await dispatchCampaign(campaignData);
      toast.success('Campaign dispatched successfully!');
      
    } catch (error: any) {
      console.error('Failed to dispatch campaign:', error);
      toast.error(`Failed to dispatch campaign: ${error.message}`);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      await duplicateCampaign(campaignId);
    } catch (error) {
      console.error('Failed to duplicate campaign:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading campaigns...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Campaign History</h2>
        
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No campaigns found. Create your first campaign to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{campaign.subject}</h3>
                        <Badge className={`${getStatusColor(campaign.status)} flex items-center gap-1`}>
                          {getStatusIcon(campaign.status)}
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>From:</strong> {campaign.from_name}</p>
                        <p><strong>Recipients:</strong> {campaign.total_recipients?.toLocaleString() || 0}</p>
                        {campaign.sent_count > 0 && (
                          <p><strong>Sent:</strong> {campaign.sent_count?.toLocaleString() || 0}</p>
                        )}
                        <p><strong>Created:</strong> {format(new Date(campaign.created_at), 'MMM dd, yyyy HH:mm')}</p>
                        {campaign.sent_at && (
                          <p><strong>Sent:</strong> {format(new Date(campaign.sent_at), 'MMM dd, yyyy HH:mm')}</p>
                        )}
                        {campaign.error_message && (
                          <p className="text-red-600"><strong>Error:</strong> {campaign.error_message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handlePrepareCampaign(campaign)}
                          className="flex items-center gap-1"
                          disabled={false}
                        >
                          <Settings className="w-3 h-3" />
                          Prepare
                        </Button>
                      )}
                      
                      {campaign.status === 'prepared' && (
                        <Button
                          size="sm"
                          onClick={() => handleSendCampaign(campaign)}
                          className="flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Send Now
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCampaign(campaign)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateCampaign(campaign.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this campaign? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteCampaign(campaign.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Campaign Edit Dialog */}
      {editingCampaign && (
        <CampaignEditDialog
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
        />
      )}

      {/* Campaign Preparation Dialog */}
      {preparingCampaign && (
        <CampaignPreparationDialog
          open={!!preparingCampaign}
          campaignId={preparingCampaign}
          totalRecipients={campaigns.find(c => c.id === preparingCampaign)?.total_recipients || 0}
          onComplete={() => {
            setPreparingCampaign(null);
            toast.success('Campaign prepared successfully!');
          }}
          onCancel={() => {
            setPreparingCampaign(null);
            toast.info('Campaign preparation cancelled');
          }}
        />
      )}
    </>
  );
};

export default CampaignHistory;
