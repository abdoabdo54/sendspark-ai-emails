
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Settings, Trash2, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGcfFunctions } from '@/hooks/useGcfFunctions';
import { useSimpleOrganizations } from '@/contexts/SimpleOrganizationContext';
import { useNavigate } from 'react-router-dom';

const FunctionManager = () => {
  const navigate = useNavigate();
  const { currentOrganization } = useSimpleOrganizations();
  const { functions, loading, createFunction, updateFunction, deleteFunction } = useGcfFunctions(currentOrganization?.id);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFunction, setNewFunction] = useState({
    name: '',
    url: '',
    enabled: true,
    region: '',
    notes: ''
  });

  const handleAddFunction = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization first",
        variant: "destructive"
      });
      return;
    }

    if (!newFunction.name.trim() || !newFunction.url.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive"
      });
      return;
    }

    // Validate URL format
    try {
      new URL(newFunction.url);
    } catch {
      toast({
        title: "Validation Error",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await createFunction(newFunction);
      if (result) {
        setIsAddDialogOpen(false);
        setNewFunction({
          name: '',
          url: '',
          enabled: true,
          region: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error adding function:', error);
    }
  };

  const handleToggleFunction = async (functionId: string, enabled: boolean) => {
    try {
      await updateFunction(functionId, { enabled });
    } catch (error) {
      console.error('Error toggling function:', error);
    }
  };

  const handleDeleteFunction = async (functionId: string, functionName: string) => {
    if (window.confirm(`Are you sure you want to delete "${functionName}"?`)) {
      try {
        await deleteFunction(functionId);
      } catch (error) {
        console.error('Error deleting function:', error);
      }
    }
  };

  const testFunction = async (url: string, name: string) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      if (response.ok) {
        toast({
          title: "Health Check Passed",
          description: `${name} is responding correctly`,
        });
      } else {
        toast({
          title: "Health Check Failed",
          description: `${name} returned status ${response.status}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Health Check Failed",
        description: `Cannot reach ${name}: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const formatLastUsed = (lastUsed?: string) => {
    if (!lastUsed) return 'Never';
    return new Date(lastUsed).toLocaleString();
  };

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Function Manager</h1>
            <p className="text-red-600 mt-4">Please select an organization to continue.</p>
          </div>
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
              Manage your Google Cloud Functions for bulk email dispatch
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/')} variant="outline">
              Back to Campaigns
            </Button>
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
                  <div>
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={newFunction.region}
                      onChange={(e) => setNewFunction(prev => ({ ...prev, region: e.target.value }))}
                      placeholder="us-central1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newFunction.notes}
                      onChange={(e) => setNewFunction(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional description or configuration notes"
                      rows={3}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Cloud Functions ({functions.filter(f => f.enabled).length} active)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading functions...</p>
              </div>
            ) : functions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No Cloud Functions configured yet</p>
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
                    <TableHead>Region</TableHead>
                    <TableHead>Last Used</TableHead>
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
                      <TableCell>{func.region || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatLastUsed(func.last_used)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testFunction(func.url, func.name)}
                          >
                            <ExternalLink className="w-3 h-3" />
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

        {functions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {functions.filter(f => f.last_used).length}
                  </div>
                  <div className="text-sm text-gray-600">Recently Used</div>
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
