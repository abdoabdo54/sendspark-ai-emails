
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface GoogleSheetsImportProps {
  onImport: (emails: string[]) => void;
}

const GoogleSheetsImport = ({ onImport }: GoogleSheetsImportProps) => {
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleImport = async () => {
    if (!sheetsUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Google Sheets URL",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate import process
      for (let i = 0; i <= 100; i += 10) {
        setImportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Mock imported data
      const mockData = [
        { email: 'john@example.com', name: 'John Doe', company: 'Tech Corp' },
        { email: 'jane@example.com', name: 'Jane Smith', company: 'Design Studio' },
        { email: 'bob@example.com', name: 'Bob Wilson', company: 'Marketing Inc' },
      ];

      setImportedData(mockData);
      
      toast({
        title: "Import Successful",
        description: `Imported ${mockData.length} contacts from Google Sheets`
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import data from Google Sheets",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = () => {
    const emails = importedData.map(row => row.email);
    onImport(emails);
    setIsOpen(false);
    setImportedData([]);
    setSheetsUrl('');
    toast({
      title: "Contacts Added",
      description: `Added ${emails.length} email addresses to recipients`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Import from Sheets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-600" />
            Google Sheets Import
          </DialogTitle>
          <DialogDescription>
            Import email addresses and contact data from a published Google Sheet
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheetsUrl">Google Sheets URL</Label>
            <Input
              id="sheetsUrl"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Make sure your Google Sheet is published and accessible via link
            </p>
          </div>
          
          {isImporting && (
            <div className="space-y-2">
              <Label>Import Progress</Label>
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm text-slate-600">Importing data... {importProgress}%</p>
            </div>
          )}
          
          {importedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Import Preview
                </CardTitle>
                <CardDescription>
                  {importedData.length} contacts found. Review and confirm import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {importedData.map((row, index) => (
                    <div key={index} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium">{row.email}</p>
                        <p className="text-sm text-slate-600">{row.name} - {row.company}</p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="flex gap-3">
            {importedData.length > 0 ? (
              <Button onClick={confirmImport} className="w-full">
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Import ({importedData.length} contacts)
              </Button>
            ) : (
              <Button 
                onClick={handleImport} 
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Download className="w-4 h-4 mr-2 animate-pulse" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
            )}
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Setup Instructions:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Open your Google Sheet</li>
                  <li>Click File → Share → Publish to web</li>
                  <li>Select "Entire Document" and "Web page"</li>
                  <li>Copy the published URL and paste it above</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleSheetsImport;
