
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Eye, MousePointer, Code, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TrackingLinksManagerProps {
  campaignId?: string;
  onTrackingToggle: (enabled: boolean) => void;
  onHtmlContentUpdate: (content: string) => void;
  htmlContent: string;
  autoTrackingEnabled: boolean;
}

const TrackingLinksManager = ({ 
  campaignId = 'CAMPAIGN_ID', 
  onTrackingToggle, 
  onHtmlContentUpdate,
  htmlContent,
  autoTrackingEnabled 
}: TrackingLinksManagerProps) => {
  const [sampleEmail, setSampleEmail] = useState('recipient@example.com');
  const [sampleUrl, setSampleUrl] = useState('https://yourwebsite.com/landing-page');

  const baseUrl = window.location.origin;
  
  const trackingPixel = `<img src="${baseUrl}/functions/v1/track-open?campaign=${campaignId}&email={{email}}" width="1" height="1" style="display:none;" />`;
  
  const clickTrackingUrl = `${baseUrl}/functions/v1/track-click?campaign=${campaignId}&email={{email}}&url=${encodeURIComponent(sampleUrl)}`;
  
  const sampleTrackingPixel = `<img src="${baseUrl}/functions/v1/track-open?campaign=${campaignId}&email=${encodeURIComponent(sampleEmail)}" width="1" height="1" style="display:none;" />`;
  
  const sampleClickUrl = `${baseUrl}/functions/v1/track-click?campaign=${campaignId}&email=${encodeURIComponent(sampleEmail)}&url=${encodeURIComponent(sampleUrl)}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`
    });
  };

  const addTrackingToContent = () => {
    let updatedContent = htmlContent;
    
    // Add tracking pixel at the end
    if (!updatedContent.includes('track-open')) {
      if (updatedContent.includes('</body>')) {
        updatedContent = updatedContent.replace('</body>', `${trackingPixel}</body>`);
      } else {
        updatedContent += trackingPixel;
      }
    }
    
    // Convert existing links to tracked links
    updatedContent = updatedContent.replace(
      /<a\s+href="([^"]+)"([^>]*)>/gi,
      (match, url, attributes) => {
        if (url.includes('track-click')) return match; // Already tracked
        const trackedUrl = `${baseUrl}/functions/v1/track-click?campaign=${campaignId}&email={{email}}&url=${encodeURIComponent(url)}`;
        return `<a href="${trackedUrl}"${attributes}>`;
      }
    );
    
    onHtmlContentUpdate(updatedContent);
    toast({
      title: "Tracking Added!",
      description: "Open and click tracking has been added to your email content"
    });
  };

  const removeTrackingFromContent = () => {
    let updatedContent = htmlContent;
    
    // Remove tracking pixel
    updatedContent = updatedContent.replace(/<img[^>]*track-open[^>]*>/gi, '');
    
    // Convert tracked links back to normal links
    updatedContent = updatedContent.replace(
      new RegExp(`<a\\s+href="${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/functions/v1/track-click\\?campaign=[^&]*&email=[^&]*&url=([^"]*)"([^>]*)>`, 'gi'),
      (match, encodedUrl, attributes) => {
        try {
          const originalUrl = decodeURIComponent(encodedUrl);
          return `<a href="${originalUrl}"${attributes}>`;
        } catch {
          return match;
        }
      }
    );
    
    onHtmlContentUpdate(updatedContent);
    toast({
      title: "Tracking Removed!",
      description: "All tracking has been removed from your email content"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Email Tracking Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Control email tracking for opens and clicks. You can automatically add tracking or manually copy the tracking codes below.
          </AlertDescription>
        </Alert>

        {/* Auto Tracking Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label className="text-base font-medium">Automatic Tracking</Label>
            <p className="text-sm text-gray-600">
              Automatically add open and click tracking to your emails
            </p>
          </div>
          <Switch
            checked={autoTrackingEnabled}
            onCheckedChange={onTrackingToggle}
          />
        </div>

        {/* Manual Tracking Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Manual Tracking Integration</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTrackingToContent}
                className="flex items-center gap-2"
              >
                <Code className="w-4 h-4" />
                Add to Content
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeTrackingFromContent}
                className="flex items-center gap-2"
              >
                Remove Tracking
              </Button>
            </div>
          </div>
        </div>

        {/* Sample Email for Testing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sample-email">Sample Email (for testing)</Label>
            <Input
              id="sample-email"
              value={sampleEmail}
              onChange={(e) => setSampleEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          <div>
            <Label htmlFor="sample-url">Sample URL (for click tracking)</Label>
            <Input
              id="sample-url"
              value={sampleUrl}
              onChange={(e) => setSampleUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        {/* Open Tracking Pixel */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <Label className="font-medium">Open Tracking Pixel</Label>
            <Badge variant="secondary">1x1 Invisible Image</Badge>
          </div>
          
          <div>
            <Label className="text-sm text-gray-600">Template Code (use {{email}} placeholder):</Label>
            <div className="flex items-center gap-2 mt-1">
              <Textarea
                value={trackingPixel}
                readOnly
                className="font-mono text-sm"
                rows={3}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(trackingPixel, 'Open tracking pixel template')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm text-gray-600">Sample with actual email:</Label>
            <div className="flex items-center gap-2 mt-1">
              <Textarea
                value={sampleTrackingPixel}
                readOnly
                className="font-mono text-sm"
                rows={3}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(sampleTrackingPixel, 'Sample open tracking pixel')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Click Tracking URL */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            <Label className="font-medium">Click Tracking URL</Label>
            <Badge variant="secondary">Link Wrapper</Badge>
          </div>
          
          <div>
            <Label className="text-sm text-gray-600">Template URL (use {{email}} placeholder):</Label>
            <div className="flex items-center gap-2 mt-1">
              <Textarea
                value={clickTrackingUrl}
                readOnly
                className="font-mono text-sm"
                rows={3}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(clickTrackingUrl, 'Click tracking URL template')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm text-gray-600">Sample with actual email:</Label>
            <div className="flex items-center gap-2 mt-1">
              <Textarea
                value={sampleClickUrl}
                readOnly
                className="font-mono text-sm"
                rows={3}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(sampleClickUrl, 'Sample click tracking URL')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <Alert>
          <Code className="h-4 w-4" />
          <AlertDescription>
            <strong>Usage Instructions:</strong><br />
            • Open Tracking: Add the pixel image anywhere in your HTML, preferably before closing body tag<br />
            • Click Tracking: Replace your normal links with the tracking URLs<br />
            • Use {{email}} as a placeholder - it will be replaced with actual recipient emails<br />
            • All tracking data will appear in your Campaign Analytics dashboard
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default TrackingLinksManager;
