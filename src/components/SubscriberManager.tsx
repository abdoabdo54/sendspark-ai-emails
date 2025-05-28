import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubscribers } from '@/hooks/useSubscribers';
import { useEmailLists } from '@/hooks/useEmailLists';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Users, UserPlus, Upload, Filter, MoreHorizontal, Mail, Tag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SubscriberManager = () => {
  const { currentOrganization } = useOrganizations();
  const { subscribers, loading: subscribersLoading, addSubscriber, updateSubscriber, deleteSubscriber, importSubscribers } = useSubscribers(currentOrganization?.id);
  const { lists, loading: listsLoading, createList } = useEmailLists(currentOrganization?.id);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddSubscriber = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;
    const tags = (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(Boolean);

    try {
      await addSubscriber({
        email,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone: phone || undefined,
        tags,
        status: 'active',
        custom_fields: {},
        source: 'manual'
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding subscriber:', error);
    }
  };

  const handleImportSubscribers = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const csvData = formData.get('csvData') as string;

    if (!csvData.trim()) {
      toast({
        title: "Error",
        description: "Please paste CSV data",
        variant: "destructive"
      });
      return;
    }

    try {
      await importSubscribers(csvData);
      setIsImportDialogOpen(false);
    } catch (error) {
      console.error('Error importing subscribers:', error);
    }
  };

  const handleCreateList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const tags = (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(Boolean);

    try {
      await createList({
        name,
        description: description || undefined,
        tags,
        is_active: true
      });
      setIsListDialogOpen(false);
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesStatus = selectedStatus === 'all' || subscriber.status === selectedStatus;
    const matchesSearch = searchTerm === '' || 
      subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subscriber.first_name && subscriber.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (subscriber.last_name && subscriber.last_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  if (subscribersLoading || listsLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Subscribers</p>
                <p className="text-2xl font-bold">{subscribers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold">
                  {subscribers.filter(s => s.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserPlus className="h-5 w-5 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold">
                  {subscribers.filter(s => {
                    const createdDate = new Date(s.created_at);
                    const now = new Date();
                    return createdDate.getMonth() === now.getMonth() && 
                           createdDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Tag className="h-5 w-5 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Email Lists</p>
                <p className="text-2xl font-bold">{lists.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscribers</CardTitle>
              <CardDescription>Manage your email subscribers and lists</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Tag className="h-4 w-4 mr-2" />
                    Create List
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Email List</DialogTitle>
                    <DialogDescription>
                      Create a new email list to organize your subscribers
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateList} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">List Name</Label>
                      <Input id="name" name="name" placeholder="e.g., Newsletter Subscribers" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" placeholder="Brief description of this list" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input id="tags" name="tags" placeholder="newsletter, updates, promotions" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsListDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create List</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Subscribers</DialogTitle>
                    <DialogDescription>
                      Import subscribers from CSV data. Format: email, first_name, last_name
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleImportSubscribers} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="csvData">CSV Data</Label>
                      <Textarea 
                        id="csvData" 
                        name="csvData" 
                        placeholder="email,first_name,last_name&#10;john@example.com,John,Doe&#10;jane@example.com,Jane,Smith"
                        rows={10}
                        required 
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Import Subscribers</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Subscriber
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Subscriber</DialogTitle>
                    <DialogDescription>
                      Add a new subscriber to your email list
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubscriber} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input id="email" name="email" type="email" placeholder="subscriber@example.com" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" name="firstName" placeholder="John" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" name="lastName" placeholder="Doe" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="+1234567890" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input id="tags" name="tags" placeholder="newsletter, customer, vip" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Subscriber</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search subscribers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscribers Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell className="font-medium">{subscriber.email}</TableCell>
                    <TableCell>
                      {subscriber.first_name || subscriber.last_name 
                        ? `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          subscriber.status === 'active' ? 'default' :
                          subscriber.status === 'unsubscribed' ? 'secondary' :
                          subscriber.status === 'bounced' ? 'destructive' :
                          'outline'
                        }
                      >
                        {subscriber.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {subscriber.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {subscriber.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{subscriber.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscriber.subscribed_at 
                        ? new Date(subscriber.subscribed_at).toLocaleDateString()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSubscribers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No subscribers found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || selectedStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first subscriber.'
                }
              </p>
              {!searchTerm && selectedStatus === 'all' && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Subscriber
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriberManager;
