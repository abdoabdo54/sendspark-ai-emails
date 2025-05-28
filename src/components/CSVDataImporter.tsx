
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CSVDataImporterProps {
  onImport: (data: Array<{ [key: string]: any }>) => void;
}

const CSVDataImporter = ({ onImport }: CSVDataImporterProps) => {
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState<Array<{ [key: string]: any }>>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvText(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csvContent: string) => {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have at least a header row and one data row",
          variant: "destructive"
        });
        return;
      }

      // Parse headers
      const headerLine = lines[0];
      const parsedHeaders = parseCSVLine(headerLine);
      setHeaders(parsedHeaders);

      // Parse data rows
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === parsedHeaders.length) {
          const rowData: { [key: string]: any } = {};
          parsedHeaders.forEach((header, index) => {
            rowData[header.toLowerCase().trim()] = values[index].trim();
          });
          dataRows.push(rowData);
        }
      }

      setPreviewData(dataRows.slice(0, 5)); // Show first 5 rows for preview

      toast({
        title: "CSV Parsed",
        description: `Found ${dataRows.length} rows with ${parsedHeaders.length} columns`,
      });

    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Failed to parse CSV data",
        variant: "destructive"
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result.map(item => item.replace(/^"|"$/g, ''));
  };

  const handleTextAreaChange = (value: string) => {
    setCsvText(value);
    if (value.trim()) {
      parseCSV(value);
    } else {
      setPreviewData([]);
      setHeaders([]);
    }
  };

  const handleImport = () => {
    if (previewData.length === 0) {
      toast({
        title: "No Data",
        description: "Please add CSV data before importing",
        variant: "destructive"
      });
      return;
    }

    if (!headers.includes('email') && !headers.find(h => h.toLowerCase().includes('email'))) {
      toast({
        title: "Missing Email Column",
        description: "CSV must contain an 'email' column",
        variant: "destructive"
      });
      return;
    }

    // Parse all data, not just preview
    const lines = csvText.trim().split('\n');
    const allData = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const rowData: { [key: string]: any } = {};
        headers.forEach((header, index) => {
          rowData[header.toLowerCase().trim()] = values[index].trim();
        });
        allData.push(rowData);
      }
    }

    onImport(allData);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload CSV File</Label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => document.getElementById('csv-upload')?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Choose File
          </Button>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <span className="text-sm text-slate-600">or paste CSV data below</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>CSV Data</Label>
        <Textarea
          placeholder="email,firstname,lastname,company&#10;john@example.com,John,Doe,Acme Corp&#10;jane@example.com,Jane,Smith,Tech Inc"
          value={csvText}
          onChange={(e) => handleTextAreaChange(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Data Preview
            </CardTitle>
            <CardDescription>
              First 5 rows of your CSV data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Columns Found:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {headers.map(header => (
                    <Badge 
                      key={header} 
                      variant={header.toLowerCase().includes('email') ? 'default' : 'secondary'}
                    >
                      {header}
                    </Badge>
                  ))}
                </div>
              </div>

              {previewData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-slate-50">
                        {headers.map(header => (
                          <th key={header} className="border p-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t">
                          {headers.map(header => (
                            <td key={header} className="border p-2">
                              {row[header.toLowerCase().trim()] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button 
                onClick={handleImport}
                className="w-full"
                disabled={previewData.length === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                Import {csvText.trim().split('\n').length - 1} Recipients
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CSVDataImporter;
