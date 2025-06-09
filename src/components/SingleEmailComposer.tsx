
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SingleEmailComposerProps {
  onSend: (emailData: any) => void;
}

const SingleEmailComposer: React.FC<SingleEmailComposerProps> = ({ onSend }) => {
  const [fromName, setFromName] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');

  const handleSend = () => {
    if (!recipient.trim() || !subject.trim() || !fromName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in From Name, Recipient, and Subject",
        variant: "destructive"
      });
      return;
    }

    const emailData = {
      from_name: fromName,
      subject,
      recipients: recipient,
      html_content: htmlContent,
      text_content: textContent,
      send_method: 'single'
    };

    onSend(emailData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Single Email Composer
          </CardTitle>
          <CardDescription>
            Send a personalized email to a single recipient
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
              <Label htmlFor="recipient">Recipient Email</Label>
              <Input
                id="recipient"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="htmlContent">Email Content (HTML)</Label>
            <Textarea
              id="htmlContent"
              placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="textContent">Plain Text Version (Optional)</Label>
            <Textarea
              id="textContent"
              placeholder="Hello! Your plain text email content here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleSend}
            className="w-full"
            size="lg"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SingleEmailComposer;
