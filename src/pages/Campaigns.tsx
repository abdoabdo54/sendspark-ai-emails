
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Play, Pause, Copy, Trash2, BarChart3, Users, Mail, Calendar, TestTube, Send, Eye, Edit, Settings, Zap } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useOrganizations } from '@/hooks/useOrganizations';
import { toast } from '@/hooks/use-toast';
import { sendEmailViaAppsScript } from '@/utils/appsScriptSender';
import { sendEmailViaSMTP } from '@/utils/emailSender';
import CampaignEditDialog from '@/components/CampaignEditDialog';

const Campaigns = () => {
  const { currentOrganization } = useOrganizations();
  const { campaigns, loading, prepareCampaign, sendCampaign, resumeCampaign, pauseCampaign, duplicateCampaign, deleteCampaign } = useCampaigns(currentOrganization?.id);
  const { accounts } = useEmailAccounts(currentOrganization?.id);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Play className="w-4 h-4 text-blue-600" />;
      case 'prepared': return <Zap className="w-4 h-4 text-orange-600" />;
      case 'sending': return <Send className="w-4 h-4 text-green-600" />;
      case 'sent': return <Mail className="w-4 h-4 text-slate-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-600" />;
      case 'failed': return <Trash2 className="w-4 h-4 text-red-600" />;
      default: return <Mail className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      prepared: 'default',
      sending: 'default',
      sent: 'outline',
      paused: 'destructive',
      failed: 'destructive'
    };
    return variants[status as keyof typeof variants] || 'outline';
  };

  const getProgress = (campaign: any) => {
    if (campaign.total_recipients === 0) return 0;
    return (campaign.sent_count / campaign.total_recipients) * 100;
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

  const handlePrepareCampaign = async (campaignId: string) => {
    setIsPreparing(campaignId);
    try {
      await prepareCampaign(campaignId);
      toast({
        title: "Campaign Prepared",
        description: "Your campaign has been prepared and is ready to send!"
      });
    } catch (error) {
      console.error('Failed to prepare campaign:', error);
      toast({
        title: "Failed to Prepare Campaign",
        description: "There was an error preparing your campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPreparing(null);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    setIsSending(campaignId);
    try {
      await sendCampaign(campaignId);
      toast({
        title: "Campaign Started",
        description: "Your campaign is now being sent!"
      });
    } catch (error) {
      console.error('Failed to start campaign:', error);
      toast({
        title: "Failed to Start Campaign",
        description: "There was an error starting your campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(null);
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    setIsSending(campaignId);
    try {
      await resumeCampaign(campaignId);
      toast({
        title: "Campaign Resumed",
        description: "Your campaign has been resumed!"
      });
    } catch (error) {
      console.error('Failed to resume campaign:', error);
      toast({
        title: "Failed to Resume Campaign",
        description: "There was an error resuming your campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(null);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      await pauseCampaign(campaignId);
      toast({
        title: "Campaign Paused",
        description: "Your campaign has been paused."
      });
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      toast({
        title: "Failed to Pause Campaign",
        description: "There was an error pausing your campaign. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTestCampaign = async (campaign: any) => {
    setIsTesting(campaign.id);
    
    try {
      // Get the first available account
      const availableAccounts = accounts.filter(acc => acc.is_active);
      if (availableAccounts.length === 0) {
        toast({
          title: "No Active Accounts",
          description: "Please configure and activate at least one email account to test campaigns.",
          variant: "destructive"
        });
        return;
      }

      const testAccount = availableAccounts[0];
      const testEmail = testAccount.email; // Send test to the account's own email
      
      // Process content with sample data
      let testHtml = campaign.html_content || '';
      let testSubject = `[TEST] ${campaign.subject}`;
      
      // Replace basic tags with test values
      testHtml = testHtml.replace(/\[from\]/g, campaign.from_name);
      testHtml = testHtml.replace(/\[subject\]/g, campaign.subject);
      testHtml = testHtml.replace(/\[to\]/g, testEmail);
      testSubject = testSubject.replace(/\[from\]/g, campaign.from_name);

      // Send test email based on account type
      let result;
      if (testAccount.type === 'apps-script') {
        result = await sendEmailViaAppsScript(
          testAccount.config,
          testAccount.email,
          campaign.from_name,
          testEmail,
          testSubject,
          testHtml,
          campaign.text_content
        );
      } else if (testAccount.type === 'smtp') {
        result = await sendEmailViaSMTP(
          testAccount.config,
          testAccount.email,
          campaign.from_name,
          testEmail,
          testSubject,
          testHtml,
          campaign.text_content
        );
      } else {
        throw new Error(`Account type ${testAccount.type} not supported for testing`);
      }

      if (result.success) {
        toast({
          title: "Test Email Sent",
          description: `Test email sent successfully to ${testEmail} using ${testAccount.name}!`
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.error || "Failed to send test email",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to test campaign:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleDuplicateCampaign = async (campaign: any) => {
    try {
      await duplicateCampaign(campaign.id);
    } catch (error) {
      console.error('Failed to duplicate campaign:', error);
      toast({
        title: "Duplication Failed",
        description: "Failed to duplicate the campaign. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const handlePreviewCampaign = (campaign: any) => {
    // Process content with sample data for preview
    let previewHtml = campaign.html_content || '';
    previewHtml = previewHtml.replace(/\[from\]/g, campaign.from_name);
    previewHtml = previewHtml.replace(/\[subject\]/g, campaign.subject);
    previewHtml = previewHtml.replace(/\[to\]/g, 'preview@example.com');

    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Campaign Preview - ${campaign.subject}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .content { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>📧 Campaign Preview</h2>
              <p><strong>From:</strong> ${campaign.from_name}</p>
              <p><strong>Subject:</strong> ${campaign.subject}</p>
              <p><strong>Method:</strong> ${campaign.send_method}</p>
              <p><strong>Recipients:</strong> ${campaign.total_recipients} total</p>
            </div>
            <div class="content">
              ${previewHtml}
            </div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Campaign Management
          </h1>
          <p className="text-slate-600 text-lg">
            Manage, monitor, and control your email campaigns
          </p>
        </div>

        {/* Campaign Grid */}
        <div className="grid gap-6">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No campaigns found</h3>
                <p className="text-slate-500 text-center mb-4">
                  Create your first email campaign to see it here
                </p>
                <Button onClick={() => window.location.href = '/'}>
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(campaign.status)}
                      <div>
                        <CardTitle className="text-xl">{campaign.from_name}</CardTitle>
                        <CardDescription className="text-base">{campaign.subject}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadge(campaign.status) as any} className="text-sm">
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {campaign.send_method.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium">Recipients</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{campaign.total_recipients.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm font-medium">Sent</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{campaign.sent_count.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm font-medium">Progress</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{getProgress(campaign).toFixed(1)}%</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Created</span>
                      </div>
                      <p className="text-sm font-bold text-purple-600">{formatDate(campaign.created_at)}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(campaign.status === 'sending' || campaign.status === 'prepared') && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>{campaign.status === 'prepared' ? 'Ready to Send' : 'Sending Progress'}</span>
                        <span>{getProgress(campaign).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            campaign.status === 'prepared' 
                              ? 'bg-gradient-to-r from-orange-500 to-yellow-500' 
                              : 'bg-gradient-to-r from-blue-600 to-purple-600'
                          }`}
                          style={{ width: `${campaign.status === 'prepared' ? 100 : getProgress(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {campaign.status === 'draft' && (
                      <>
                        <Button 
                          className="flex items-center gap-2"
                          onClick={() => handlePrepareCampaign(campaign.id)}
                          disabled={isPreparing === campaign.id}
                        >
                          {isPreparing === campaign.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Preparing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Prepare Campaign
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {campaign.status === 'prepared' && (
                      <Button 
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600"
                        onClick={() => handleResumeCampaign(campaign.id)}
                        disabled={isSending === campaign.id}
                      >
                        {isSending === campaign.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Starting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Start Sending
                          </>
                        )}
                      </Button>
                    )}

                    {campaign.status === 'sending' && (
                      <Button 
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => handlePauseCampaign(campaign.id)}
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </Button>
                    )}

                    {campaign.status === 'paused' && (
                      <Button 
                        className="flex items-center gap-2"
                        onClick={() => handleResumeCampaign(campaign.id)}
                        disabled={isSending === campaign.id}
                      >
                        {isSending === campaign.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Resuming...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Resume
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handleTestCampaign(campaign)}
                      disabled={isTesting === campaign.id}
                    >
                      {isTesting === campaign.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4" />
                          Test
                        </>
                      )}
                    </Button>

                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handlePreviewCampaign(campaign)}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>

                    <CampaignEditDialog 
                      campaign={campaign}
                      trigger={
                        <Button variant="outline" className="flex items-center gap-2">
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      }
                    />
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handleDuplicateCampaign(campaign)}
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{campaign.subject}"? This action cannot be undone.
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
                  </div>

                  {/* Campaign Details */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Method:</span> {campaign.send_method}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {formatDate(campaign.created_at)}
                      </div>
                      {campaign.sent_at && (
                        <div>
                          <span className="font-medium">Sent:</span> {formatDate(campaign.sent_at)}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Success Rate:</span> {
                          campaign.total_recipients > 0 
                            ? ((campaign.sent_count / campaign.total_recipients) * 100).toFixed(1)
                            : '0.0'
                        }%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
