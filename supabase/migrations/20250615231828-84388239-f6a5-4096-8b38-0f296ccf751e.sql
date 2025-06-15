
-- Create PowerMTA servers table
CREATE TABLE public.powermta_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  server_host TEXT NOT NULL,
  ssh_port INTEGER NOT NULL DEFAULT 22,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  api_port INTEGER,
  virtual_mta TEXT,
  job_pool TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.powermta_servers ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view servers in their organization
CREATE POLICY "Users can view servers in their organization" 
  ON public.powermta_servers 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

-- Create policy for users to create servers in their organization
CREATE POLICY "Users can create servers in their organization" 
  ON public.powermta_servers 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

-- Create policy for users to update servers in their organization
CREATE POLICY "Users can update servers in their organization" 
  ON public.powermta_servers 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

-- Create policy for users to delete servers in their organization
CREATE POLICY "Users can delete servers in their organization" 
  ON public.powermta_servers 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_powermta_servers_updated_at
  BEFORE UPDATE ON public.powermta_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_powermta_servers_organization_active 
  ON public.powermta_servers(organization_id, is_active);
