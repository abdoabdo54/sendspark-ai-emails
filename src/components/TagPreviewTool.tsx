
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Copy, Search } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface TagPreviewToolProps {
  onTagInsert: (tag: string) => void;
}

const TagPreviewTool = ({ onTagInsert }: TagPreviewToolProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const tagCategories = [
    {
      name: "Personal Information",
      tags: [
        { tag: "{{[fromname]}}", description: "Sender's display name" },
        { tag: "{{[to]}}", description: "Recipient's email address" },
        { tag: "{{[toname]}}", description: "Recipient's name" },
        { tag: "{{[company]}}", description: "Recipient's company" }
      ]
    },
    {
      name: "Email Meta",
      tags: [
        { tag: "{{[subject]}}", description: "Email subject line" },
        { tag: "{{[date]}}", description: "Current date" },
        { tag: "{{[time]}}", description: "Current time" },
        { tag: "{{[datetime]}}", description: "Current date and time" }
      ]
    },
    {
      name: "Random Generators",
      tags: [
        { tag: "{{[rndn_10]}}", description: "Random 10-digit number" },
        { tag: "{{[rnds_8]}}", description: "Random 8-character string" },
        { tag: "{{[uuid]}}", description: "Unique identifier" },
        { tag: "{{[token]}}", description: "Security token" }
      ]
    },
    {
      name: "Special Tokens",
      tags: [
        { tag: "#{{[token]}}", description: "Hash-prefixed token" },
        { tag: "{{[unsubscribe]}}", description: "Unsubscribe link" },
        { tag: "{{[tracking]}}", description: "Tracking pixel" },
        { tag: "{{[signature]}}", description: "Email signature" }
      ]
    }
  ];

  const filteredCategories = tagCategories.map(category => ({
    ...category,
    tags: category.tags.filter(tag => 
      tag.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tag.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.tags.length > 0);

  const insertTag = (tag: string) => {
    onTagInsert(tag);
    toast({
      title: "Tag Inserted",
      description: `Added ${tag} to your email content`
    });
  };

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    toast({
      title: "Copied",
      description: `${tag} copied to clipboard`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          Tag Library
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Dynamic Tag Library
          </DialogTitle>
          <DialogDescription>
            Browse and insert dynamic tags for email personalization
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="overflow-y-auto max-h-[500px] space-y-4">
            {filteredCategories.map((category, categoryIndex) => (
              <Card key={categoryIndex}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.tags.map((tagItem, tagIndex) => (
                    <div 
                      key={tagIndex}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <Badge variant="secondary" className="font-mono text-xs mb-1">
                          {tagItem.tag}
                        </Badge>
                        <p className="text-sm text-slate-600">{tagItem.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyTag(tagItem.tag)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTag(tagItem.tag)}
                        >
                          Insert
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Separator />
          
          <div className="bg-amber-50 p-3 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Tags are processed when emails are sent. 
              Each tag generates dynamic values based on recipient data and context.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TagPreviewTool;
