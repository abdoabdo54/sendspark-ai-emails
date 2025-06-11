
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Settings, Trash2, TestTube, Zap } from 'lucide-react';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useNavigate } from 'react-router-dom';

const FunctionManager = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { functions, loading, createFunction, updateFunction, deleteFunction, testFunction } = useGcfFunctions(currentOrganization?.id);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFunction, setNewFunction] = useState({
    name: '',
    url: '',
    enabled: true
  });

  // Testing section state
  const [testUrl, setTestUrl] = useState('');
  const [testName, setTestName] = useState('Test Function');
  const [isTestingFunction, setIsTestingFunction] = useState(false);

  const handleAddFunction = async () => {
    if (!newFunction.name.trim() || !newFunction.url.trim()) {
      return;
    }

    try {
      new URL(newFunction.url);
    } catch {
      return;
    }

    const result = await createFunction(newFunction);
    if (result) {
      setIsAddDialogOpen(false);
      setNewFunction({ name: '', url: '', enabled: true });
    }
  };

  const handleToggleFunction = async (functionId: string, enabled: boolean) => {
    await updateFunction(functionId, { enabled });
  };

  const handleDeleteFunction = async (functionId: string, functionName: string) => {
    if (window.confirm(`Are you sure you want to delete "${functionName}"?`)) {
      await deleteFunction(functionId);
    }
  };

  const handleTestFunction = async () => {
    if (!testUrl.trim()) return;
    
    setIsTestingFunction(true);
    await testFunction(testUrl, testName);
    setIsTestingFunction(false);
  };

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900">Function Manager</h1>
          <p className="text-red-600 mt-4">Please select an organization to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Function Manager</h1>
            <p className="text-gray-600">
              Manage your Google Cloud Functions for parallel email dispatch
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/smart-config')} variant="outline">
              <Zap className="w-4 h-4 mr-2" />
              Smart Config
            </Button>
            <Button onClick={() => navigate('/')} variant="outline">
              Back to Campaigns
            </Button>
          </div>
        </div>

        {/* Function Testing Section */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <TestTube className="w-5 h-5" />
              Function Testing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-orange-700 text-sm">
              Test any Google Cloud Function URL before adding it to your collection
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="testName">Function Name</Label>
                <Input
                  id="testName"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="My Test Function"
                />
              </div>
              <div>
                <Label htmlFor="testUrl">Function URL</Label>
                <Input
                  id="testUrl"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://region-project.cloudfunctions.net/functionName"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleTestFunction}
                  disabled={isTestingFunction || !testUrl.trim()}
                  className="w-full"
                >
                  {isTestingFunction ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Testing...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Test Function
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Functions Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Registered Functions ({functions.filter(f => f.enabled).length} active)
              </CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Function
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Cloud Function</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Function Name *</Label>
                      <Input
                        id="name"
                        value={newFunction.name}
                        onChange={(e) => setNewFunction(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="sendBatch1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="url">Function URL *</Label>
                      <Input
                        id="url"
                        value={newFunction.url}
                        onChange={(e) => setNewFunction(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://region-project.cloudfunctions.net/sendBatch1"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newFunction.enabled}
                        onCheckedChange={(enabled) => setNewFunction(prev => ({ ...prev, enabled }))}
                      />
                      <Label>Enable this function</Label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddFunction}>
                        Add Function
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading functions...</p>
              </div>
            ) : functions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No Cloud Functions registered yet</p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Function
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {functions.map((func) => (
                    <TableRow key={func.id}>
                      <TableCell className="font-medium">{func.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{func.url}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={func.enabled}
                            onCheckedChange={(enabled) => handleToggleFunction(func.id, enabled)}
                          />
                          <Badge variant={func.enabled ? "default" : "secondary"}>
                            {func.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testFunction(func.url, func.name)}
                          >
                            <TestTube className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteFunction(func.id, func.name)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        {functions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Function Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{functions.length}</div>
                  <div className="text-sm text-gray-600">Total Functions</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {functions.filter(f => f.enabled).length}
                  </div>
                  <div className="text-sm text-gray-600">Active Functions</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FunctionManager;
