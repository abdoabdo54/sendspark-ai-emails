
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClientCampaignPreparationProgress from './ClientCampaignPreparationProgress';
import { useClientCampaignPreparation } from '@/hooks/useClientCampaignPreparation';

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
  const { 
    prepareCampaignClientSide, 
    isProcessing: isClientProcessing,
    progress: clientProgress,
    currentBatch,
    totalBatches
  } = useClientCampaignPreparation();
  
  const [preparingCampaignId, setPreparingCampaignId] = useState<string | null>(null);
  const [sendingCampaigns, setSendingCampaigns] = useState<Set<string>>(new Set());
  const [clientPreparationStatus, setClientPreparationStatus] = useState<'preparing' | 'completed' | 'error'>('preparing');
  const [clientPreparationMessage, setClientPreparationMessage] = useState('Starting preparation...');
  const [clientEmailCount, setClientEmailCount] = useState(0);

  // FIXED: Smart refresh - ONLY during preparation, with proper timing
  useEffect(() => {
    // Only refresh when there are campaigns actively preparing
    const preparingCampaigns = campaigns.filter(c => c.status === 'preparing');
    
    if (preparingCampaigns.length > 0 && !preparingCampaignId) {
      console.log('🔄 Auto-refresh PREPARATION ONLY: monitoring', preparingCampaigns.length, 'preparing campaigns');
      const interval = setInterval(() => {
        refetch();
      }, 2000); // 2 second refresh during preparation

      return () => {
        console.log('🛑 Auto-refresh stopped - no more preparing campaigns');
        clearInterval(interval);
      };
    } else {
      console.log('✅ No preparation active, auto-refresh disabled');
    }
  }, [campaigns.filter(c => c.status === 'preparing').length, preparingCampaignId, refetch]);

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
          console.log('🔧 Starting CLIENT-SIDE campaign preparation:', campaignId);
          setPreparingCampaignId(campaignId);
          setClientPreparationStatus('preparing');
          setClientPreparationMessage('Starting client-side preparation...');
          
          // Get campaign to estimate email count
          const prepareCampaign = campaigns.find(c => c.id === campaignId);
          if (prepareCampaign) {
            const recipientText = prepareCampaign.recipients || '';
            let estimatedCount = 0;
            if (recipientText.includes(',') || recipientText.includes('\n') || recipientText.includes(';')) {
              const separators = [',', '\n', ';'];
              for (const sep of separators) {
                if (recipientText.includes(sep)) {
                  estimatedCount = Math.max(estimatedCount, recipientText.split(sep).length);
                }
              }
            } else if (recipientText.trim()) {
              estimatedCount = 1;
            }
            setClientEmailCount(estimatedCount);
            setClientPreparationMessage(`Processing ${estimatedCount.toLocaleString()} emails locally...`);
          }

          try {
            const result = await prepareCampaignClientSide(campaignId);
            console.log('✅ Client preparation completed:', result);
            
            setClientPreparationStatus('completed');
            setClientPreparationMessage(`Successfully prepared ${result.emailCount} emails!`);
            
            // Auto-close and refresh after 2 seconds
            setTimeout(() => {
              setPreparingCampaignId(null);
              // Refresh 2 seconds after popup closes
              setTimeout(() => {
                console.log('🔄 Refreshing campaigns after client preparation');
                refetch();
              }, 2000);
            }, 1500);
            
          } catch (error: any) {
            console.error('❌ Client preparation failed:', error);
            setClientPreparationStatus('error');
            setClientPreparationMessage(`Preparation failed: ${error.message}`);
          }
          break;
        case 'send':
          const sendCampaign = campaigns.find(c => c.id === campaignId);
          if (sendCampaign) {
            console.log('🚀 CRITICAL: Dispatching campaign with PERFECT DISTRIBUTION:', {
              id: campaignId,
              sendingMode: sendCampaign.config?.sendingMode,
              selectedAccounts: sendCampaign.config?.selectedAccounts?.length || 0
            });
            
            // Mark as sending for UI tracking
            setSendingCampaigns(prev => new Set([...prev, campaignId]));
            
            await dispatchCampaign({
              from_name: sendCampaign.from_name,
              subject: sendCampaign.subject,
              recipients: sendCampaign.recipients,
              html_content: sendCampaign.html_content,
              text_content: sendCampaign.text_content,
              send_method: sendCampaign.send_method,
              config: sendCampaign.config
            });
            
            // FIXED: Single toast notification - no duplicates
            console.log('✅ Campaign sent successfully with perfect distribution!');
            
            // Remove from sending tracking and refresh once
            setSendingCampaigns(prev => {
              const newSet = new Set(prev);
              newSet.delete(campaignId);
              return newSet;
            });
            
            // Single refresh after sending
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
      
      // Remove from sending tracking on error
      setSendingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

  const handlePreparationComplete = () => {
    console.log('✅ Preparation completed, stopping auto-refresh');
    setPreparingCampaignId(null);
    // FIXED: Refresh 2 seconds after popup closes as requested
    setTimeout(() => {
      console.log('🔄 Refreshing campaigns 2 seconds after preparation popup closed');
      refetch();
    }, 2000);
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
                              campaign.config.sendingMode === 'zero-delay' ? '🚀 ZERO DELAY (PERFECT SPEED)' :
                              campaign.config.sendingMode === 'fast' ? 'Fast (0.5s delay)' :
                              campaign.config.sendingMode === 'controlled' ? 'Controlled (2s delay)' :
                              campaign.config.sendingMode || 'controlled'
                            }</span>
                            <span>🔄 Method: {
                              campaign.config.dispatchMethod === 'parallel' ? 'Parallel (Perfect Distribution)' :
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
                          {campaign.config.sendingMode === 'zero-delay' && (
                            <div className="text-orange-600 font-medium">🚀 ZERO DELAY: Perfect distribution with maximum speed!</div>
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
                        {campaign.config?.sendingMode === 'zero-delay' ? '🚀 SEND PERFECT SPEED' : 'Send Now'}
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
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>🖥️ Client-Side Preparation</DialogTitle>
              <DialogDescription>
                Processing campaign locally to avoid server memory limits
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <ClientCampaignPreparationProgress
                isProcessing={isClientProcessing}
                progress={clientProgress}
                currentBatch={currentBatch}
                totalBatches={totalBatches}
                emailCount={clientEmailCount}
                status={clientPreparationStatus}
                message={clientPreparationMessage}
              />
            </div>

            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setPreparingCampaignId(null)}
                size="sm"
                disabled={isClientProcessing}
              >
                {isClientProcessing ? 'Processing...' : 'Close'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CampaignHistory;
