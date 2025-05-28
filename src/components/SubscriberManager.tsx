
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Upload, Download, Mail, Filter, Search, Loader2 } from 'lucide-react';
import { useSubscribers } from '@/hooks/useSubscribers';
import { useOrganizations } from '@/hooks/useOrganizations';

const SubscriberManager = () => {
  const { currentOrganization } = useOrganizations();
  const { subscribers, lists, loading, addSubscriber, createList, importSubscribers } = useSubscribers(currentOrganization?.id);
  const [isAddingSubscriber, setIsAddingSubscriber] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = 
      subscriber.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscriber.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscriber.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscriber.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAddSubscriber = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAddingSubscriber(true);

    const formData = new FormData(e.currentTarget);
    const subscriberData = {
      email: formData.get('email') as string,
      first_name: formData.get('firstName') as string || undefined,
      last_name: formData.get('lastName') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      status: 'active' as const,
      tags: [],
      custom_fields: {},
      subscribed_at: new Date().toISOString()
    };

    try {
      await addSubscriber(subscriberData);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error adding subscriber:', error);
    } finally {
      setIsAddingSubscriber(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreatingList(true);

    const formData = new FormData(e.currentTarget);
    const listData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      tags: [],
      is_active: true
    };

    try {
      await createList(listData);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error creating list:', error);
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsImporting(true);

    const formData = new FormData(e.currentTarget);
    const csvData = formData.get('csvData') as string;
    const listId = formData.get('listId') as string || undefined;

    try {
      await importSubscribers(csvData, listId);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error importing subscribers:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      unsubscribed: 'secondary',
      bounced: 'destructive',
      complained: 'outline'
    };
    return variants[status as keyof typeof variants] || 'outline';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subscriber Management</h2>
          <p className="text-slate-600">Manage your email lists and subscribers</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Subscriber
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Subscriber</DialogTitle>
                <DialogDescription>
                  Add a single subscriber to your organization
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="subscriber@example.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+1234567890"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAddingSubscriber}>
                  {isAddingSubscriber ? 'Adding...' : 'Add Subscriber'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="subscribers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subscribers">
            <Users className="w-4 h-4 mr-2" />
            Subscribers ({subscribers.length})
          </TabsTrigger>
          <TabsTrigger value="lists">
            <Mail className="w-4 h-4 mr-2" />
            Lists ({lists.length})
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search subscribers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="complained">Complained</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Subscribers Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>
                        {subscriber.first_name || subscriber.last_name ? 
                          `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim() 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadge(subscriber.status) as any}>
                          {subscriber.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(subscriber.subscribed_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {subscriber.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredSubscribers.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No subscribers found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Email Lists</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
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
                    <Input
                      id="name"
                      name="name"
                      placeholder="Newsletter Subscribers"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Description of this email list..."
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreatingList}>
                    {isCreatingList ? 'Creating...' : 'Create List'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {lists.map((list) => (
              <Card key={list.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{list.name}</CardTitle>
                      <CardDescription>{list.description}</CardDescription>
                    </div>
                    <Badge>{list.subscriber_count} subscribers</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 flex-wrap">
                    {list.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {lists.length === 0 && (
              <Card>
                <CardContent className="text-center py-8 text-slate-500">
                  No email lists created yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Subscribers from CSV</CardTitle>
              <CardDescription>
                Upload a CSV file with your subscriber data. Include headers: email, first_name, last_name, phone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportCSV} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="listId">Add to List (Optional)</Label>
                  <Select name="listId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="csvData">CSV Data</Label>
                  <Textarea
                    id="csvData"
                    name="csvData"
                    placeholder="email,first_name,last_name,phone
john@example.com,John,Doe,+1234567890
jane@example.com,Jane,Smith,+0987654321"
                    rows={10}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isImporting}>
                  {isImporting ? 'Importing...' : 'Import Subscribers'}
                  <Upload className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SubscriberManager;
