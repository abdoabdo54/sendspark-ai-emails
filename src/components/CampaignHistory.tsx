
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Copy, Trash2, Edit, Clock, Zap } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useCampaignSender } from '@/hooks/useCampaignSender';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CampaignAnalyticsDropdown from './CampaignAnalyticsDropdown';
import CampaignEditDialog from './CampaignEditDialog';
import CampaignPreparationDialog from './CampaignPreparationDialog';

const CampaignHistory = () => {
  const { currentOrganization } = useSimpleOrganizations();
  const { 
    campaigns, 
    loading, 
    pauseCampaign, 
    resumeCampaign,
    duplicateCampaign,
    deleteCampaign,
    refetch
  } = useCampaigns(currentOrganization?.id);
  
  const { sendCampaign: dispatchCampaign } = useCampaignSender(currentOrganization?.id);
  const [preparingCampaignId, setPreparingCampaignId] = useState<string | null>(null);

  // Auto-refresh campaigns every 3 seconds to show status updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'sending': return 'bg-blue-100 text-blue-800';
      case 'prepared': return 'bg-yellow-100 text-yellow-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAction = async (action: string, campaignId: string) => {
    try {
      switch (action) {
        case 'prepare':
          console.log('🔧 Starting campaign preparation:', campaignId);
          setPreparingCampaignId(campaignId);
          break;
        case 'send':
          const campaign = campaigns.find(c => c.id === campaignId);
          if (campaign) {
            console.log('🚀 CRITICAL: Dispatching campaign with PRESERVED config:', {
              id: campaignId,
              config: campaign.config,
              sendingMode: campaign.config?.sendingMode,
              dispatchMethod: campaign.config?.dispatchMethod,
              selectedAccounts: campaign.config?.selectedAccounts,
              customFunctionCount: campaign.config?.customFunctionCount,
              customAccountCount: campaign.config?.customAccountCount
            });
            
            await dispatchCampaign({
              from_name: campaign.from_name,
              subject: campaign.subject,
              recipients: campaign.recipients,
              html_content: campaign.html_content,
              text_content: campaign.text_content,
              send_method: campaign.send_method,
              config: campaign.config
            });
            
            toast.success('🚀 Campaign sent successfully!');
            
            // Force refresh after sending
            setTimeout(() => {
              refetch();
            }, 1000);
          } else {
            throw new Error('Campaign not found');
          }
          break;
        case 'pause':
          await pauseCampaign(campaignId);
          toast.success('Campaign paused');
          break;
        case 'resume':
          await resumeCampaign(campaignId);
          toast.success('Campaign resumed');
          break;
        case 'duplicate':
          await duplicateCampaign(campaignId);
          toast.success('Campaign duplicated');
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this campaign?')) {
            await deleteCampaign(campaignId);
            toast.success('Campaign deleted');
          }
          break;
      }
    } catch (error) {
      console.error('❌ Action failed:', error);
      toast.error(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreparationComplete = () => {
    setPreparingCampaignId(null);
    // Force refresh campaigns to show updated status
    setTimeout(() => {
      refetch();
    }, 500);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading campaigns...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Campaign History</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No campaigns found. Create your first campaign to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{campaign.subject}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        From: {campaign.from_name}
                      </p>
                      <p className="text-sm text-slate-600">
                        Recipients: {campaign.total_recipients} | 
                        Sent: {campaign.sent_count}
                      </p>
                      
                      {campaign.config && (
                        <div className="text-xs text-slate-500 mt-2 space-y-1">
                          <div className="flex gap-4 flex-wrap">
                            <span>📧 Accounts: {campaign.config.selectedAccounts?.length || 0} selected</span>
                            <span>⚡ Mode: {
                              campaign.config.sendingMode === 'zero-delay' ? 'Zero Delay (Max Speed)' :
                              campaign.config.sendingMode === 'fast' ? 'Fast (0.5s delay)' :
                              campaign.config.sendingMode === 'controlled' ? 'Controlled (2s delay)' :
                              campaign.config.sendingMode || 'controlled'
                            }</span>
                            <span>🔄 Method: {
                              campaign.config.dispatchMethod === 'parallel' ? 'Parallel (All functions)' :
                              campaign.config.dispatchMethod === 'round-robin' ? 'Round Robin (Rotate accounts)' :
                              campaign.config.dispatchMethod === 'sequential' ? 'Sequential' :
                              campaign.config.dispatchMethod || 'parallel'
                            }</span>
                          </div>
                          {campaign.config.useCustomConfig && (
                            <div className="flex gap-4">
                              <span>🎯 Custom Functions: {campaign.config.customFunctionCount || 'auto'}</span>
                              <span>📬 Custom Accounts: {campaign.config.customAccountCount || 'auto'}</span>
                            </div>
                          )}
                          {campaign.config.testAfter?.enabled && (
                            <div>🎯 Test-After: {campaign.config.testAfter.email} every {campaign.config.testAfter.count} emails</div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-xs text-slate-500 mt-2">
                        Created: {format(new Date(campaign.created_at), 'MMM dd, yyyy HH:mm')}
                        {campaign.sent_at && (
                          <> | Sent: {format(new Date(campaign.sent_at), 'MMM dd, yyyy HH:mm')}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap gap-2">
                    {campaign.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('prepare', campaign.id)}
                        className="flex items-center gap-1"
                      >
                        <Clock className="w-4 h-4" />
                        Prepare
                      </Button>
                    )}
                    
                    {campaign.status === 'prepared' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction('send', campaign.id)}
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                      >
                        <Zap className="w-4 h-4" />
                        Send Now
                      </Button>
                    )}
                    
                    {campaign.status === 'sending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('pause', campaign.id)}
                        className="flex items-center gap-1"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </Button>
                    )}
                    
                    {campaign.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction('resume', campaign.id)}
                        className="flex items-center gap-1"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </Button>
                    )}

                    {campaign.status !== 'sending' && (
                      <CampaignEditDialog 
                        campaign={campaign}
                        trigger={
                          <Button size="sm" variant="outline" className="flex items-center gap-1">
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                        }
                      />
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('duplicate', campaign.id)}
                      className="flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>

                    {campaign.status !== 'sending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('delete', campaign.id)}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    )}
                  </div>

                  {/* Analytics Dropdown */}
                  <CampaignAnalyticsDropdown 
                    campaignId={campaign.id}
                    campaignName={campaign.subject}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preparation Dialog */}
      {preparingCampaignId && (
        <CampaignPreparationDialog
          isOpen={true}
          onClose={() => setPreparingCampaignId(null)}
          campaignId={preparingCampaignId}
          onComplete={handlePreparationComplete}
        />
      )}
    </div>
  );
};

export default CampaignHistory;
