
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
import CampaignSendMethodSelector from "./CampaignSendMethodSelector";
import MiddlewareController from "./MiddlewareController";

interface CampaignPrepareAndSendProps {
  campaignId: string;
}

interface CampaignConfig {
  sendMethod?: 'cloud_functions' | 'middleware';
  [key: string]: any;
}

const CampaignPrepareAndSend: React.FC<CampaignPrepareAndSendProps> = ({ campaignId }) => {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [preparationDone, setPreparationDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
  const [sendMethod, setSendMethod] = useState<'cloud_functions' | 'middleware'>('cloud_functions');

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

  const handleSendViaMiddleware = async () => {
    setSending(true);
    setSendResults(null);
    
    try {
      console.log('🔄 Creating email jobs for middleware processing');
      
      if (!campaign.prepared_emails || !Array.isArray(campaign.prepared_emails) || campaign.prepared_emails.length === 0) {
        throw new Error('No prepared emails found. Please prepare the campaign first.');
      }
      
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

      console.log(`📤 Creating ${emailJobs.length} email jobs for middleware`);

      const { error: jobsError } = await supabase
        .from('email_jobs')
        .insert(emailJobs);

      if (jobsError) {
        console.error('❌ Error creating email jobs:', jobsError);
        throw jobsError;
      }

      // Update campaign status and config
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
              2. <strong>Choose Method</strong>: Cloud Functions or PowerMTA Middleware<br/>
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
              <CampaignSendMethodSelector
                selectedMethod={sendMethod}
                onMethodChange={setSendMethod}
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
                  console.log(`🚀 Sending campaign via ${sendMethod}`);
                  if (sendMethod === 'cloud_functions') {
                    handleSend();
                  } else if (sendMethod === 'middleware') {
                    handleSendViaMiddleware();
                  }
                }}
                disabled={
                  sending || 
                  isSending || 
                  campaign.status === "sent"
                }
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {(sending || isSending) ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-1" />
                    {sendMethod === 'cloud_functions' && 'Sending Ultra-Fast...'}
                    {sendMethod === 'middleware' && 'Setting up Middleware...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {sendMethod === 'cloud_functions' && '3. Send Now (Cloud Functions)'}
                    {sendMethod === 'middleware' && '3. Setup Middleware Processing'}
                  </>
                )}
              </Button>
              
              {sendProgress > 0 && (
                <div className="mt-2 text-xs text-green-700">
                  {sendMethod === 'cloud_functions' ? 'Sending' : 'Setting up'} progress: {sendProgress}%
                </div>
              )}

              {sendResults && (
                <Alert className={sendResults.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <AlertDescription>
                    {sendResults.success ? (
                      <>
                        <strong>🚀 {sendResults.method === 'middleware' ? 'Middleware Setup' : 'Send'} Results:</strong><br/>
                        • Emails {sendResults.method === 'middleware' ? 'queued for processing' : 'sent'}: {sendResults.totalEmails}<br/>
                        {sendResults.actualDuration && (
                          <>
                            • Duration: {sendResults.actualDuration}ms<br/>
                            • Speed: {Math.round(sendResults.totalEmails / (sendResults.actualDuration / 1000))} emails/second<br/>
                          </>
                        )}
                        {sendResults.message && (
                          <>• Message: {sendResults.message}</>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>❌ {sendMethod === 'cloud_functions' ? 'Send' : 'Middleware Setup'} Failed:</strong><br/>
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
