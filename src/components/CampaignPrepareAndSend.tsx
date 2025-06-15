import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, Send, Rocket, Loader2, Zap } from "lucide-react";
import { useClientCampaignPreparation } from "@/hooks/useClientCampaignPreparation";
import { useCampaignSender } from "@/hooks/useCampaignSender";
import { supabase } from "@/integrations/supabase/client";

interface CampaignPrepareAndSendProps {
  campaignId: string;
}

const CampaignPrepareAndSend: React.FC<CampaignPrepareAndSendProps> = ({ campaignId }) => {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [preparationDone, setPreparationDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta'>('cloud_functions');
  const [powerMTAServers, setPowerMTAServers] = useState<any[]>([]);
  const [selectedPowerMTA, setSelectedPowerMTA] = useState<string>('');

  const { prepareCampaignClientSide, isProcessing, progress } = useClientCampaignPreparation();
  const { sendCampaign, isSending, progress: sendProgress } = useCampaignSender(campaign?.organization_id);

  // Fetch campaign details with optimized query
  useEffect(() => {
    async function fetchCampaign() {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("id, subject, status, organization_id, prepared_emails, total_recipients")
        .eq("id", campaignId)
        .single();
      if (error) {
        toast.error(`Error loading campaign: ${error.message}`);
      } else {
        setCampaign(data);
        setPreparationDone(data.status === "prepared" || data.status === "sent");
      }
      setLoading(false);
    }
    fetchCampaign();
  }, [campaignId]);

  // Load PowerMTA servers
  useEffect(() => {
    async function loadPowerMTAServers() {
      if (!campaign?.organization_id) return;
      
      const { data } = await supabase
        .from('powermta_servers')
        .select('*')
        .eq('organization_id', campaign.organization_id)
        .eq('is_active', true);
      
      setPowerMTAServers(data || []);
      if (data && data.length > 0) {
        setSelectedPowerMTA(data[0].id);
      }
    }
    
    if (campaign) {
      loadPowerMTAServers();
    }
  }, [campaign]);

  // Optimized refresh function
  const refresh = async () => {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select("id, subject, status, organization_id, prepared_emails, total_recipients")
      .eq("id", campaignId)
      .single();
    if (!error) {
      setCampaign(data);
      setPreparationDone(data.status === "prepared" || data.status === "sent");
    }
  };

  const handlePrepare = async () => {
    setPreparing(true);
    try {
      const result = await prepareCampaignClientSide(campaignId);
      toast.success(result?.message || "Campaign prepared and pushed to Supabase!");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to prepare campaign.");
    } finally {
      setPreparing(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setSendResults(null);
    const startTime = Date.now();
    
    try {
      const result = await sendCampaign(campaign);
      const duration = Date.now() - startTime;
      
      setSendResults({
        ...result,
        actualDuration: duration
      });
      
      toast.success(`🚀 Ultra-Fast Send Complete! ${result.totalEmails} emails sent in ${duration}ms`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send campaign.");
    } finally {
      setSending(false);
    }
  };

  const handleSendViaPowerMTA = async () => {
    if (!selectedPowerMTA) {
      toast.error('Please select a PowerMTA server');
      return;
    }

    setSending(true);
    setSendResults(null);
    const startTime = Date.now();
    
    try {
      // Get selected PowerMTA server config
      const { data: powerMTAConfig } = await supabase
        .from('powermta_servers')
        .select('*')
        .eq('id', selectedPowerMTA)
        .single();

      if (!powerMTAConfig) {
        throw new Error('PowerMTA server configuration not found');
      }

      // Get sender accounts
      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', campaign.organization_id)
        .eq('is_active', true)
        .in('type', ['smtp', 'apps-script']);

      if (!accounts || accounts.length === 0) {
        throw new Error('No active sender accounts found');
      }

      console.log('📤 Pushing campaign to PowerMTA server...');
      
      const { pushCampaignToPowerMTA } = await import('@/utils/powerMTASender');
      
      const result = await pushCampaignToPowerMTA(powerMTAConfig, {
        campaignId: campaign.id,
        subject: campaign.subject,
        html_content: campaign.html_content || '',
        text_content: campaign.text_content || '',
        from_name: campaign.from_name,
        prepared_emails: campaign.prepared_emails || [],
        sender_accounts: accounts
      });

      const duration = Date.now() - startTime;
      
      if (result.success) {
        setSendResults({
          success: true,
          method: 'powermta',
          queueId: result.queueId,
          totalEmails: campaign.prepared_emails?.length || 0,
          actualDuration: duration,
          serverName: powerMTAConfig.name
        });
        
        // Update campaign status
        await supabase
          .from('email_campaigns')
          .update({ 
            status: 'sent_to_powermta',
            powermta_queue_id: result.queueId
          })
          .eq('id', campaignId);
        
        toast.success(`🚀 Campaign pushed to PowerMTA server "${powerMTAConfig.name}" successfully!`);
        await refresh();
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast.error(`PowerMTA push failed: ${e?.message || 'Unknown error'}`);
      setSendResults({
        success: false,
        error: e?.message || 'PowerMTA push failed'
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-red-600 p-4">Campaign not found.</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <Rocket className="inline w-5 h-5 mb-1 mr-2" />
            {campaign.subject}
          </CardTitle>
          <div className="text-xs text-gray-500">
            Campaign ID: {campaignId} <br />
            Status: <span className="font-semibold">{campaign.status}</span>
            {campaign.total_recipients && (
              <>
                <br />Recipients: <span className="font-semibold">{campaign.total_recipients}</span>
              </>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Ultra-Fast 3-Step Process:</strong><br/>
              1. <strong>Prepare</strong>: Process emails in browser and push to Supabase<br/>
              2. <strong>Choose Method</strong>: Cloud Functions (direct) or PowerMTA (server bridge)<br/>
              3. <strong>Send</strong>: Fire all emails via selected method<br/>
            </AlertDescription>
          </Alert>

          {!preparationDone ? (
            <div>
              <Button
                size="lg"
                onClick={handlePrepare}
                disabled={preparing || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {preparing || isProcessing ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-1" /> Preparing & Pushing to Supabase...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    1. Prepare Campaign (Browser Processing)
                  </>
                )}
              </Button>
              {progress > 0 && (
                <div className="mt-2 text-xs text-blue-700">
                  Preparation progress: {progress}%
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription>
                  ✅ Campaign prepared and ready for sending!
                </AlertDescription>
              </Alert>
              
              {/* Send Method Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Choose Sending Method:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant={sendMethod === 'cloud_functions' ? 'default' : 'outline'}
                    onClick={() => setSendMethod('cloud_functions')}
                    className="w-full"
                  >
                    Cloud Functions (Direct)
                  </Button>
                  <Button
                    variant={sendMethod === 'powermta' ? 'default' : 'outline'}
                    onClick={() => setSendMethod('powermta')}
                    className="w-full"
                    disabled={powerMTAServers.length === 0}
                  >
                    PowerMTA Server {powerMTAServers.length === 0 ? '(No servers)' : ''}
                  </Button>
                </div>
              </div>

              {/* PowerMTA Server Selection */}
              {sendMethod === 'powermta' && powerMTAServers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select PowerMTA Server:</label>
                  <select
                    value={selectedPowerMTA}
                    onChange={(e) => setSelectedPowerMTA(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    {powerMTAServers.map(server => (
                      <option key={server.id} value={server.id}>
                        {server.name} ({server.server_host})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Send Button */}
              <Button
                size="lg"
                variant="default"
                onClick={sendMethod === 'cloud_functions' ? handleSend : handleSendViaPowerMTA}
                disabled={sending || isSending || campaign.status === "sent"}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {(sending || isSending) ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-1" />
                    {sendMethod === 'cloud_functions' ? 'Sending Ultra-Fast...' : 'Pushing to PowerMTA...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {sendMethod === 'cloud_functions' 
                      ? '2. Send Now (Cloud Functions)' 
                      : '2. Push to PowerMTA Server'}
                  </>
                )}
              </Button>
              
              {sendProgress > 0 && (
                <div className="mt-2 text-xs text-green-700">
                  {sendMethod === 'cloud_functions' ? 'Sending' : 'Pushing'} progress: {sendProgress}%
                </div>
              )}

              {sendResults && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription>
                    {sendResults.success ? (
                      <>
                        <strong>🚀 {sendResults.method === 'powermta' ? 'PowerMTA Push' : 'Send'} Results:</strong><br/>
                        {sendResults.method === 'powermta' ? (
                          <>
                            • Campaign pushed to: {sendResults.serverName}<br/>
                            • Queue ID: {sendResults.queueId}<br/>
                            • Emails queued: {sendResults.totalEmails}<br/>
                            • Duration: {sendResults.actualDuration}ms<br/>
                            • Status: PowerMTA will process using your sender accounts
                          </>
                        ) : (
                          <>
                            • Emails sent: {sendResults.totalEmails}<br/>
                            • Duration: {sendResults.actualDuration}ms<br/>
                            • Speed: {Math.round(sendResults.totalEmails / (sendResults.actualDuration / 1000))} emails/second
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>❌ {sendResults.method === 'powermta' ? 'PowerMTA Push' : 'Send'} Failed:</strong><br/>
                        Error: {sendResults.error}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignPrepareAndSend;
