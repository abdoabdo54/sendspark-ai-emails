
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Eye, Copy, Star } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  thumbnail: string;
  isPopular?: boolean;
}

interface EmailTemplateLibraryProps {
  onSelectTemplate: (template: EmailTemplate) => void;
}

const EmailTemplateLibrary = ({ onSelectTemplate }: EmailTemplateLibraryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const templates: EmailTemplate[] = [
    {
      id: '1',
      name: 'Newsletter Welcome',
      category: 'newsletter',
      description: 'Professional welcome email for new subscribers',
      subject: 'Welcome to {{[fromname]}} Newsletter!',
      htmlContent: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #333; text-align: center;">Welcome {{[to]}}!</h1>
          <p>Thank you for subscribing to our newsletter. We're excited to have you on board!</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>What to expect:</h3>
            <ul>
              <li>Weekly industry insights</li>
              <li>Exclusive offers and discounts</li>
              <li>Early access to new features</li>
            </ul>
          </div>
          <p>Best regards,<br>The {{[fromname]}} Team</p>
        </div>
      `,
      textContent: 'Welcome {{[to]}}! Thank you for subscribing to our newsletter...',
      thumbnail: 'newsletter',
      isPopular: true
    },
    {
      id: '2',
      name: 'Product Launch',
      category: 'marketing',
      description: 'Announce new product launches with style',
      subject: '🚀 Introducing Our Latest Product!',
      htmlContent: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center;">
            <h1>🚀 Big News, {{[to]}}!</h1>
            <p style="font-size: 18px;">We're thrilled to announce our latest product</p>
          </div>
          <div style="padding: 30px 20px;">
            <h2>What's New?</h2>
            <p>Our team has been working hard to bring you something amazing...</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Learn More</a>
            </div>
          </div>
        </div>
      `,
      textContent: 'Big News! We\'re thrilled to announce our latest product...',
      thumbnail: 'product',
      isPopular: true
    },
    {
      id: '3',
      name: 'Event Invitation',
      category: 'events',
      description: 'Invite subscribers to upcoming events',
      subject: 'You\'re Invited! Join Us for {{[event_name]}}',
      htmlContent: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #28a745;">
            <h1 style="color: #28a745; margin: 0;">You're Invited!</h1>
          </div>
          <div style="padding: 30px 20px;">
            <p>Hi {{[to]}},</p>
            <p>We're excited to invite you to our upcoming event...</p>
            <div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Event Details:</h3>
              <p><strong>Date:</strong> [Event Date]</p>
              <p><strong>Time:</strong> [Event Time]</p>
              <p><strong>Location:</strong> [Event Location]</p>
            </div>
            <div style="text-align: center;">
              <a href="#" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">RSVP Now</a>
            </div>
          </div>
        </div>
      `,
      textContent: 'You\'re Invited! We\'re excited to invite you to our upcoming event...',
      thumbnail: 'event'
    },
    {
      id: '4',
      name: 'Promotional Sale',
      category: 'marketing',
      description: 'Drive sales with compelling promotional emails',
      subject: '🎉 Flash Sale: {{[discount]}}% Off Everything!',
      htmlContent: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px;">🎉 FLASH SALE</h1>
            <p style="font-size: 24px; margin: 10px 0;">{{[discount]}}% OFF EVERYTHING</p>
          </div>
          <div style="padding: 30px 20px; text-align: center;">
            <p>Hi {{[to]}},</p>
            <p>Don't miss out on our biggest sale of the year!</p>
            <div style="background: #fff3cd; border: 2px dashed #ffc107; padding: 20px; margin: 20px 0;">
              <h3 style="color: #856404; margin: 0;">Limited Time Offer</h3>
              <p style="color: #856404; margin: 10px 0;">Use code: <strong>SAVE{{[discount]}}</strong></p>
            </div>
            <a href="#" style="background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 18px;">Shop Now</a>
          </div>
        </div>
      `,
      textContent: 'FLASH SALE! Don\'t miss out on our biggest sale of the year...',
      thumbnail: 'sale',
      isPopular: true
    }
  ];

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'newsletter', name: 'Newsletter' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'events', name: 'Events' },
    { id: 'transactional', name: 'Transactional' }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-5 w-full md:w-auto">
            {categories.map(category => (
              <TabsTrigger key={category.id} value={category.id} className="text-xs">
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="group hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {template.name}
                    {template.isPopular && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        <Star className="w-3 h-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {template.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-slate-600">Subject Preview:</p>
                  <p className="text-sm text-slate-800">{template.subject}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {/* Preview functionality */}}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Use Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Search className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No templates found</h3>
            <p className="text-slate-500 text-center">
              Try adjusting your search terms or category filter
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmailTemplateLibrary;
