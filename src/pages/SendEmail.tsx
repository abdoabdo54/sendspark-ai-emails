
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TestTube, Shield, Search, Zap } from 'lucide-react';
import SMTPTestTool from '@/components/tools/SMTPTestTool';
import AppsScriptTestTool from '@/components/tools/AppsScriptTestTool';

const SendEmail = () => {
  const [activeTab, setActiveTab] = useState('smtp-test');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <TestTube className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Email Testing & Configuration
              </h1>
              <p className="text-slate-600 text-lg">
                Test SMTP connections, Apps Script integrations, and validate email delivery
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <TestTube className="w-3 h-3 mr-1" />
              SMTP Testing
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Shield className="w-3 h-3 mr-1" />
              Apps Script Testing
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Search className="w-3 h-3 mr-1" />
              Connection Validation
            </Badge>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              <Zap className="w-3 h-3 mr-1" />
              Real-time Testing
            </Badge>
          </div>
        </div>

        {/* Testing Interface */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Email Configuration Testing Suite</CardTitle>
            <CardDescription className="text-blue-100">
              Test SMTP connections, Apps Script integrations, and verify email delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white border-b">
                <TabsTrigger 
                  value="smtp-test" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <TestTube className="w-4 h-4" />
                  SMTP Test Tool
                </TabsTrigger>
                <TabsTrigger 
                  value="apps-script-test" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  <Shield className="w-4 h-4" />
                  Apps Script Test Tool
                </TabsTrigger>
              </TabsList>

              <TabsContent value="smtp-test" className="p-6">
                <SMTPTestTool />
              </TabsContent>

              <TabsContent value="apps-script-test" className="p-6">
                <AppsScriptTestTool />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SendEmail;
