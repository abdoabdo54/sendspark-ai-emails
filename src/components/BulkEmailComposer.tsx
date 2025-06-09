
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Upload, Type } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import CSVDataImporter from './CSVDataImporter';
import CampaignConfigSection from './CampaignConfigSection';

interface BulkEmailComposerProps {
  onSend: (campaignData: any) => void;
}

const BulkEmailComposer: React.FC<BulkEmailComposerProps> = ({ onSend }) => {
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [recipientsData, setRecipientsData] = useState<Array<{ [key: string]: any }>>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [campaignConfig, setCampaignConfig] = useState({});

  const handleCSVImport = (data: Array<{ [key: string]: any }>) => {
    setRecipientsData(data);
    toast({
      title: "Recipients Imported",
      description: `Successfully imported ${data.length} recipients from CSV`
    });
  };

  const handleSend = () => {
    let finalRecipients = '';
    
    if (recipientsData.length > 0) {
      // Use CSV data
      const emails = recipientsData.map(row => {
        const emailField = Object.keys(row).find(key => 
          key.toLowerCase().includes('email')
        );
        return emailField ? row[emailField] : '';
      }).filter(email => email);
      
      finalRecipients = emails.join(',');
    } else if (manualRecipients.trim()) {
      // Use manual input
      finalRecipients = manualRecipients;
    }

    if (!finalRecipients) {
      toast({
        title: "No Recipients",
        description: "Please add recipients either by importing CSV or manual input",
        variant: "destructive"
      });
      return;
    }

    if (!fromName.trim() || !subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in From Name and Subject",
        variant: "destructive"
      });
      return;
    }

    const campaignData = {
      from_name: fromName,
      subject,
      recipients: finalRecipients,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'bulk',
      config: campaignConfig,
      recipientData: recipientsData // Include for personalization
    };

    onSend(campaignData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Email Campaign
          </CardTitle>
          <CardDescription>
            Create and send personalized emails to multiple recipients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name or Company"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
          </div>

          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import Recipients
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Manual Input
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <CSVDataImporter onImport={handleCSVImport} />
              
              {recipientsData.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {recipientsData.length} Recipients Loaded
                    </Badge>
                  </div>
                  <p className="text-sm text-green-700">
                    Recipients imported successfully. You can use column names like {'{firstname}'}, {'{lastname}'}, {'{company}'} for personalization.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipients">Email Recipients</Label>
                <Textarea
                  id="recipients"
                  placeholder="Enter email addresses separated by commas or new lines&#10;john@example.com, jane@example.com&#10;or&#10;john@example.com&#10;jane@example.com"
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  rows={6}
                />
                <p className="text-sm text-slate-500">
                  Enter email addresses separated by commas or new lines
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="htmlContent">Email Content (HTML)</Label>
            <Textarea
              id="htmlContent"
              placeholder="<h1>Hello {firstname}!</h1><p>Your personalized email content here...</p>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={8}
            />
            <p className="text-sm text-slate-500">
              Use variables like {'{firstname}'}, {'{lastname}'}, {'{email}'} for personalization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textContent">Plain Text Version (Optional)</Label>
            <Textarea
              id="textContent"
              placeholder="Hello {firstname}! Your plain text email content here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
            />
          </div>

          <CampaignConfigSection 
            config={campaignConfig}
            onConfigChange={setCampaignConfig}
          />

          <Button 
            onClick={handleSend}
            className="w-full"
            size="lg"
          >
            <Send className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEmailComposer;
