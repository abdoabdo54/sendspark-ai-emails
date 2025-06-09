
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVDataImporterProps {
  onImport: (data: Array<{ [key: string]: any }>) => void;
}

const CSVDataImporter: React.FC<CSVDataImporterProps> = ({ onImport }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (csvText: string): Array<{ [key: string]: any }> => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const data: Array<{ [key: string]: any }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(value => value.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const row: { [key: string]: any } = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return data;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        throw new Error('No valid data found in CSV file');
      }

      onImport(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV file';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Import Recipients from CSV</Label>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-sm text-slate-600 mb-4">
            Upload a CSV file with recipient information. First row should contain headers like: email, firstname, lastname, company
          </p>
          
          <Button 
            onClick={handleUploadClick}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Choose CSV File
              </>
            )}
          </Button>
          
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-slate-500 space-y-1">
        <p><strong>CSV Format Example:</strong></p>
        <p>email,firstname,lastname,company</p>
        <p>john@example.com,John,Doe,ABC Corp</p>
        <p>jane@example.com,Jane,Smith,XYZ Inc</p>
      </div>
    </div>
  );
};

export default CSVDataImporter;
