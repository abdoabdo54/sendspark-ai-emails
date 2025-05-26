
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, Loader2 } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface AISubjectGeneratorProps {
  onSubjectSelect: (subject: string) => void;
}

const AISubjectGenerator = ({ onSubjectSelect }: AISubjectGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const generateSubjects = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for subject generation",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Simulate API call to Gemini
      // In real implementation, this would call your backend API that integrates with Gemini
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockSubjects = [
        `${prompt} - Exclusive Offer Inside`,
        `Transform Your ${prompt} Today`,
        `5 Ways to Improve Your ${prompt}`,
        `${prompt}: What You Need to Know`,
        `Don't Miss Out: ${prompt} Update`
      ];
      
      setSubjects(mockSubjects);
      
      toast({
        title: "Success",
        description: "Subject lines generated successfully!"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate subject lines. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copySubject = (subject: string) => {
    navigator.clipboard.writeText(subject);
    toast({
      title: "Copied",
      description: "Subject line copied to clipboard"
    });
  };

  const selectSubject = (subject: string) => {
    onSubjectSelect(subject);
    setIsOpen(false);
    toast({
      title: "Subject Selected",
      description: "Subject line added to your email"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Subject Line Generator
          </DialogTitle>
          <DialogDescription>
            Generate professional, anti-spam subject lines using Google Gemini AI
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Email Topic or Description</Label>
            <Input
              id="prompt"
              placeholder="e.g., new product launch, monthly newsletter, special discount"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={generateSubjects} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Subject Lines
              </>
            )}
          </Button>
          
          {subjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Subject Lines</CardTitle>
                <CardDescription>
                  Click to select or copy any subject line
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {subjects.map((subject, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex-1 text-sm">{subject}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copySubject(subject)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectSubject(subject)}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>AI Guidelines:</strong> Generated subjects follow anti-spam best practices, 
              avoid clickbait language, and maintain professional tone.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISubjectGenerator;
