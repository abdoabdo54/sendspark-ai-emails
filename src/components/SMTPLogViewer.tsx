
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SMTPLogViewerProps {
  logs: string[];
  success: boolean;
  error?: string;
  onClose: () => void;
}

const SMTPLogViewer = ({ logs, success, error, onClose }: SMTPLogViewerProps) => {
  const copyLogsToClipboard = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      toast({
        title: "Copied",
        description: "SMTP logs copied to clipboard"
      });
    });
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                SMTP Transaction Log
              </CardTitle>
              <CardDescription>
                Detailed log of SMTP communication for debugging
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={success ? 'default' : 'destructive'}>
              {success ? 'Success' : 'Failed'}
            </Badge>
            <Button variant="outline" size="sm" onClick={copyLogsToClipboard}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Logs
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}
        
        <ScrollArea className="h-96 w-full border rounded-lg p-4 bg-slate-50">
          <div className="space-y-1 font-mono text-sm">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`${
                  log.startsWith('✓') ? 'text-green-600' :
                  log.startsWith('✗') ? 'text-red-600' :
                  log.startsWith('→') ? 'text-blue-600' :
                  log.startsWith('←') ? 'text-purple-600' :
                  'text-slate-700'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 text-sm text-slate-600">
          <p><span className="text-blue-600">→</span> = Commands sent to server</p>
          <p><span className="text-purple-600">←</span> = Responses from server</p>
          <p><span className="text-green-600">✓</span> = Success messages</p>
          <p><span className="text-red-600">✗</span> = Error messages</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SMTPLogViewer;
