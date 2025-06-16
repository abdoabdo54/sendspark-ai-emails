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
import { usePowerMTAServers } from "@/hooks/usePowerMTAServers";
import { useSimpleOrganizations } from "@/contexts/SimpleOrganizationContext";
import CampaignSendMethodSelector from "./CampaignSendMethodSelector";
import MiddlewareController from "./MiddlewareController";

interface CampaignPrepareAndSendProps {
  campaignId: string;
}

interface CampaignConfig {
  sendMethod?: 'cloud_functions' | 'powermta' | 'middleware';
  selectedPowerMTAServer?: string;
  middlewareConfig?: any;
  [key: string]: any;
}

const CampaignPrepareAndSend: React.FC<CampaignPrepareAndSendProps> = ({ campaignId }) => {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [preparationDone, setPreparationDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'powermta' | 'middleware'>('cloud_functions');
  const [selectedPowerMTAServer, setSelectedPowerMTAServer] = useState<string>('');

  const { currentOrganization } = useSimpleOrganizations();
  const { servers } = usePowerMTAServers(currentOrganization?.id);
  const { prepareCampaignClientSide, isProcessing, progress } = useClientCampaignPreparation();
  const { sendCampaign, isSending, progress: sendProgress } = useCampaignSender(campaign?.organization_id);

  // Fetch campaign details with optimized query
  useEffect(() => {
    async function fetchCampaign() {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("id, subject, status, organization_id, prepared_emails, total_recipients, html_content, text_content, from_name, config")
        .eq("id", campaignId)
        .single();
      if (error) {
        toast.error(`Error loading campaign: ${error.message}`);
      } else {
        setCampaign(data);
        setPreparationDone(data.status === "prepared" || data.status === "sent");
        
        // Load previous send method from campaign config if available
        const config = data.config as CampaignConfig;
        if (config?.sendMethod) {
          setSendMethod(config.sendMethod);
        }
        if (config?.selectedPowerMTAServer) {
          setSelectedPowerMTAServer(config.selectedPowerMTAServer);
        }
      }
      setLoading(false);
    }
    fetchCampaign();
  }, [campaignId]);

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
    if (!selectedPowerMTAServer) {
      toast.error('Please select a PowerMTA server');
      return;
    }

    setSending(true);
    setSendResults(null);
    
    try {
      console.log('🚀 Pushing campaign to PowerMTA server:', selectedPowerMTAServer);
      
      // Get the selected PowerMTA server details
      const selectedServer = servers.find(s => s.id === selectedPowerMTAServer);
      if (!selectedServer) {
        throw new Error('Selected PowerMTA server not found');
      }

      // Get all active sender accounts to push to PowerMTA
      const { data: senderAccounts, error: accountsError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('organization_id', currentOrganization?.id)
        .eq('is_active', true);

      if (accountsError) throw accountsError;

      console.log('📤 Pushing sender accounts to PowerMTA:', {
        server: selectedServer.server_host,
        accountCount: senderAccounts?.length || 0,
        smtpAccounts: senderAccounts?.filter(a => a.type === 'smtp').length || 0,
        appsScriptAccounts: senderAccounts?.filter(a => a.type === 'apps-script').length || 0
      });

      // Push configuration to PowerMTA server
      const { data, error } = await supabase.functions.invoke('push-to-powermta', {
        body: {
          powermta_config: {
            server_host: selectedServer.server_host,
            ssh_port: selectedServer.ssh_port,
            username: selectedServer.username,
            password: selectedServer.password,
            api_port: selectedServer.api_port || 8080,
            virtual_mta: selectedServer.virtual_mta || 'default',
            job_pool: selectedServer.job_pool || 'default',
            proxy_enabled: selectedServer.proxy_enabled,
            proxy_host: selectedServer.proxy_host,
            proxy_port: selectedServer.proxy_port,
            proxy_username: selectedServer.proxy_username,
            proxy_password: selectedServer.proxy_password,
            manual_overrides: selectedServer.manual_overrides || {}
          },
          sender_accounts: senderAccounts || [],
          campaign_data: {
            id: campaign.id,
            subject: campaign.subject,
            html_content: campaign.html_content,
            text_content: campaign.text_content,
            from_name: campaign.from_name,
            prepared_emails: campaign.prepared_emails,
            total_recipients: campaign.total_recipients
          }
        }
      });

      if (error) throw error;

      // Update campaign status to indicate it was pushed to PowerMTA
      await supabase
        .from('email_campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          config: {
            ...campaign.config,
            sendMethod: 'powermta',
            selectedPowerMTAServer: selectedPowerMTAServer,
            powerMTAResponse: data
          }
        })
        .eq('id', campaignId);

      setSendResults({
        success: true,
        totalEmails: campaign.total_recipients,
        method: 'powermta',
        serverUsed: selectedServer.name,
        configFiles: data.configFiles,
        message: data.message || 'Campaign successfully pushed to PowerMTA server'
      });
      
      toast.success(`🚀 Campaign pushed to PowerMTA server "${selectedServer.name}"!`);
      await refresh();
    } catch (e: any) {
      console.error('❌ PowerMTA push error:', e);
      toast.error(e?.message || "Failed to push campaign to PowerMTA.");
      setSendResults({
        success: false,
        error: e?.message || "Failed to push to PowerMTA"
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendViaMiddleware = async () => {
    setSending(true);
    setSendResults(null);
    
    try {
      console.log('🔄 Creating email jobs for middleware processing');
      
      // Create email jobs in the control table
      const emailJobs = campaign.prepared_emails.map((email: any) => ({
        campaign_id: campaignId,
        recipient_email: email.to_email,
        subject: campaign.subject,
        html_content: campaign.html_content,
        text_content: campaign.text_content,
        from_name: campaign.from_name,
        from_email: email.from_email || 'noreply@example.com',
        status: 'active',
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: jobsError } = await supabase
        .from('email_jobs')
        .insert(emailJobs);

      if (jobsError) throw jobsError;

      // Update campaign status
      await supabase
        .from('email_campaigns')
        .update({
          status: 'sending',
          config: {
            ...campaign.config,
            sendMethod: 'middleware'
          }
        })
        .eq('id', campaignId);

      setSendResults({
        success: true,
        totalEmails: campaign.total_recipients,
        method: 'middleware',
        message: `${emailJobs.length} email jobs created and queued for middleware processing`
      });
      
      toast.success(`🔄 ${emailJobs.length} email jobs created for middleware processing!`);
      await refresh();
    } catch (e: any) {
      console.error('❌ Middleware setup error:', e);
      toast.error(e?.message || "Failed to setup middleware sending.");
      setSendResults({
        success: false,
        error: e?.message || "Failed to setup middleware"
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
              2. <strong>Choose Method</strong>: Cloud Functions, PowerMTA, or Middleware<br/>
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
              
              {/* Send Method Selection with PowerMTA server selection */}
              <CampaignSendMethodSelector
                selectedMethod={sendMethod}
                onMethodChange={setSendMethod}
                selectedPowerMTAServer={selectedPowerMTAServer}
                onPowerMTAServerChange={setSelectedPowerMTAServer}
              />
              
              {/* Middleware Controller */}
              {sendMethod === 'middleware' && (
                <MiddlewareController 
                  campaignId={campaignId}
                />
              )}
              
              {/* Send Button */}
              <Button
                size="lg"
                variant="default"
                onClick={() => {
                  if (sendMethod === 'cloud_functions') {
                    handleSend();
                  } else if (sendMethod === 'powermta') {
                    handleSendViaPowerMTA();
                  } else if (sendMethod === 'middleware') {
                    handleSendViaMiddleware();
                  }
                }}
                disabled={
                  sending || 
                  isSending || 
                  campaign.status === "sent" || 
                  (sendMethod === 'powermta' && !selectedPowerMTAServer)
                }
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {(sending || isSending) ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-1" />
                    {sendMethod === 'cloud_functions' && 'Sending Ultra-Fast...'}
                    {sendMethod === 'powermta' && 'Pushing to PowerMTA...'}
                    {sendMethod === 'middleware' && 'Setting up Middleware...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {sendMethod === 'cloud_functions' && '2. Send Now (Cloud Functions)'}
                    {sendMethod === 'powermta' && '2. Push to PowerMTA Server'}
                    {sendMethod === 'middleware' && '2. Setup Middleware Processing'}
                  </>
                )}
              </Button>
              
              {sendProgress > 0 && (
                <div className="mt-2 text-xs text-green-700">
                  {sendMethod === 'cloud_functions' ? 'Sending' : 
                   sendMethod === 'powermta' ? 'Pushing' : 'Setting up'} progress: {sendProgress}%
                </div>
              )}

              {sendResults && (
                <Alert className={sendResults.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <AlertDescription>
                    {sendResults.success ? (
                      <>
                        <strong>🚀 {sendResults.method === 'powermta' ? 'PowerMTA Push' : 
                                      sendResults.method === 'middleware' ? 'Middleware Setup' : 'Send'} Results:</strong><br/>
                        • Emails {sendResults.method === 'powermta' ? 'queued' : 
                                  sendResults.method === 'middleware' ? 'queued for processing' : 'sent'}: {sendResults.totalEmails}<br/>
                        {sendResults.method === 'powermta' && sendResults.serverUsed && (
                          <>• PowerMTA Server: {sendResults.serverUsed}<br/></>
                        )}
                        {sendResults.actualDuration && (
                          <>
                            • Duration: {sendResults.actualDuration}ms<br/>
                            • Speed: {Math.round(sendResults.totalEmails / (sendResults.actualDuration / 1000))} emails/second<br/>
                          </>
                        )}
                        {sendResults.configFiles && sendResults.configFiles.length > 0 && (
                          <>• Config Files: {sendResults.configFiles.join(', ')}<br/></>
                        )}
                        {sendResults.message && (
                          <>• Message: {sendResults.message}</>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>❌ {sendMethod === 'cloud_functions' ? 'Send' : 
                                      sendMethod === 'powermta' ? 'PowerMTA Push' : 'Middleware Setup'} Failed:</strong><br/>
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
