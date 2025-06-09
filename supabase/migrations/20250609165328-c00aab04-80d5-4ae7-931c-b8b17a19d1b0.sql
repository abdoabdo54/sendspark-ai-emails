
-- First, create a security definer function to get user organizations without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(user_id_param uuid)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ur.organization_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = user_id_param;
$$;

-- Create another function to check user role in organization
CREATE OR REPLACE FUNCTION public.user_has_role_in_org(user_id_param uuid, org_id_param uuid, required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = user_id_param 
    AND ur.organization_id = org_id_param 
    AND ur.role = ANY(required_roles)
  );
$$;

-- Drop and recreate RLS policies for email_accounts using the security definer functions
DROP POLICY IF EXISTS "Users can view email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can create email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update email accounts in their organizations" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete email accounts in their organizations" ON public.email_accounts;

CREATE POLICY "Users can view email accounts in their organizations" 
  ON public.email_accounts 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.get_user_organization_ids(auth.uid())
    )
  );

CREATE POLICY "Users can create email accounts in their organizations" 
  ON public.email_accounts 
  FOR INSERT 
  WITH CHECK (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin'])
  );

CREATE POLICY "Users can update email accounts in their organizations" 
  ON public.email_accounts 
  FOR UPDATE 
  USING (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin'])
  );

CREATE POLICY "Users can delete email accounts in their organizations" 
  ON public.email_accounts 
  FOR DELETE 
  USING (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin'])
  );

-- Fix organizations policies too
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON public.organizations;

CREATE POLICY "Users can view their organizations" 
  ON public.organizations 
  FOR SELECT 
  USING (
    id IN (
      SELECT organization_id FROM public.get_user_organization_ids(auth.uid())
    )
  );

CREATE POLICY "Users can update their organizations" 
  ON public.organizations 
  FOR UPDATE 
  USING (
    public.user_has_role_in_org(auth.uid(), id, ARRAY['admin', 'super_admin'])
  );

-- Fix email_campaigns policies
DROP POLICY IF EXISTS "Users can view campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can create campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can update campaigns in their organizations" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns in their organizations" ON public.email_campaigns;

CREATE POLICY "Users can view campaigns in their organizations" 
  ON public.email_campaigns 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id FROM public.get_user_organization_ids(auth.uid())
    )
  );

CREATE POLICY "Users can create campaigns in their organizations" 
  ON public.email_campaigns 
  FOR INSERT 
  WITH CHECK (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin', 'member'])
  );

CREATE POLICY "Users can update campaigns in their organizations" 
  ON public.email_campaigns 
  FOR UPDATE 
  USING (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin', 'member'])
  );

CREATE POLICY "Users can delete campaigns in their organizations" 
  ON public.email_campaigns 
  FOR DELETE 
  USING (
    public.user_has_role_in_org(auth.uid(), organization_id, ARRAY['admin', 'super_admin'])
  );
