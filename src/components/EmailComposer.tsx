
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Sparkles, Upload, Eye, Send } from 'lucide-react';
import AISubjectGenerator from './AISubjectGenerator';
import TagPreviewTool from './TagPreviewTool';
import GoogleSheetsImport from './GoogleSheetsImport';

const EmailComposer = () => {
  const [emailData, setEmailData] = useState({
    fromName: '',
    subject: '',
    recipients: '',
    htmlContent: '',
    textContent: '',
    sendMethod: 'apps-script'
  });

  const [previewMode, setPreviewMode] = useState(false);

  const handleSend = () => {
    console.log('Sending email with data:', emailData);
    // This would integrate with your backend for actual sending
  };

  const insertTag = (tag: string) => {
    setEmailData(prev => ({
      ...prev,
      htmlContent: prev.htmlContent + tag
    }));
  };

  return (
    <div className="space-y-6">
      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure your email settings and content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                placeholder="Your Name or Company"
                value={emailData.fromName}
                onChange={(e) => setEmailData(prev => ({ ...prev, fromName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendMethod">Send Method</Label>
              <Select 
                value={emailData.sendMethod} 
                onValueChange={(value) => setEmailData(prev => ({ ...prev, sendMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sending method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apps-script">Google Apps Script</SelectItem>
                  <SelectItem value="powermta">PowerMTA SMTP</SelectItem>
                  <SelectItem value="smtp">Generic SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <div className="flex gap-2">
              <Input
                id="subject"
                placeholder="Enter your email subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                className="flex-1"
              />
              <AISubjectGenerator onSubjectSelect={(subject) => 
                setEmailData(prev => ({ ...prev, subject }))
              } />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Recipients</Label>
            <Textarea
              id="recipients"
              placeholder="Enter email addresses separated by commas, or import from Google Sheets"
              value={emailData.recipients}
              onChange={(e) => setEmailData(prev => ({ ...prev, recipients: e.target.value }))}
              rows={3}
            />
            <GoogleSheetsImport onImport={(emails) => 
              setEmailData(prev => ({ ...prev, recipients: emails.join(', ') }))
            } />
          </div>
        </CardContent>
      </Card>

      {/* Email Content */}
      <Card>
        <CardHeader>
          <CardTitle>Email Content</CardTitle>
          <CardDescription>
            Create your email content with dynamic tags and personalization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="html">HTML Content</TabsTrigger>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>HTML Email Body</Label>
                <TagPreviewTool onTagInsert={insertTag} />
              </div>
              <Textarea
                placeholder="Enter your HTML email content here. Use tags like {{[fromname]}}, {{[to]}}, etc."
                value={emailData.htmlContent}
                onChange={(e) => setEmailData(prev => ({ ...prev, htmlContent: e.target.value }))}
                rows={15}
                className="font-mono text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Available tags:</Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[fromname]}}')}>
                  {'{{[fromname]}}'}
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[to]}}')}>
                  {'{{[to]}}'}
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[subject]}}')}>
                  {'{{[subject]}}'}
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => insertTag('{{[rndn_10]}}')}>
                  {'{{[rndn_10]}}'}
                </Badge>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <Label>Plain Text Email Body</Label>
              <Textarea
                placeholder="Enter the plain text version of your email"
                value={emailData.textContent}
                onChange={(e) => setEmailData(prev => ({ ...prev, textContent: e.target.value }))}
                rows={15}
              />
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="border rounded-lg p-4 bg-white">
                <div className="border-b pb-2 mb-4">
                  <p className="text-sm text-slate-600">From: {emailData.fromName || 'Your Name'}</p>
                  <p className="text-sm text-slate-600">Subject: {emailData.subject || 'Your Subject'}</p>
                </div>
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: emailData.htmlContent || '<p>Your email content will appear here...</p>' 
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Send Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              Ready to send to {emailData.recipients.split(',').filter(Boolean).length} recipients
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleSend} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Send className="w-4 h-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailComposer;
