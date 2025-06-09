
-- First, let's check and fix the RLS policies for email_accounts table
-- Enable RLS if not already enabled
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can create email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete email accounts in their organizations" ON public.email_accounts;

-- Create comprehensive RLS policies for email_accounts
CREATE POLICY "Users can view email accounts in their organizations" 
  ON public.email_accounts 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create email accounts in their organizations" 
  ON public.email_accounts 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update email accounts in their organizations" 
  ON public.email_accounts 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete email accounts in their organizations" 
  ON public.email_accounts 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Also ensure organizations table has proper RLS policies
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON public.organizations;

-- Create RLS policies for organizations
CREATE POLICY "Users can view their organizations" 
  ON public.organizations 
  FOR SELECT 
  USING (
    id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organizations" 
  ON public.organizations 
  FOR UPDATE 
  USING (
    id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Ensure email_campaigns table has proper RLS policies
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can create campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can update campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns in their organizations" ON public.email_campaigns;

-- Create RLS policies for email_campaigns
CREATE POLICY "Users can view campaigns in their organizations" 
  ON public.email_campaigns 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaigns in their organizations" 
  ON public.email_campaigns 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'member')
    )
  );

CREATE POLICY "Users can update campaigns in their organizations" 
  ON public.email_campaigns 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin', 'member')
    )
  );

CREATE POLICY "Users can delete campaigns in their organizations" 
  ON public.email_campaigns 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT ur.organization_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
    )
  );
