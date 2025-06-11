
-- First, let's fix the RLS infinite recursion issue by creating a security definer function
CREATE OR REPLACE FUNCTION public.get_user_organization_ids_safe(user_id_param uuid)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT ur.organization_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = user_id_param;
$$;

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view functions in their organization" ON public.gcf_functions;
DROP POLICY IF EXISTS "Users can create functions in their organization" ON public.gcf_functions;
DROP POLICY IF EXISTS "Users can update functions in their organization" ON public.gcf_functions;
DROP POLICY IF EXISTS "Users can delete functions in their organization" ON public.gcf_functions;

-- Create new simplified policies using the security definer function
CREATE POLICY "Users can view functions in their organization" 
  ON public.gcf_functions 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

CREATE POLICY "Users can create functions in their organization" 
  ON public.gcf_functions 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

CREATE POLICY "Users can update functions in their organization" 
  ON public.gcf_functions 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

CREATE POLICY "Users can delete functions in their organization" 
  ON public.gcf_functions 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.get_user_organization_ids_safe(auth.uid())
    )
  );

-- Simplify the gcf_functions table to only store name and url
ALTER TABLE public.gcf_functions 
DROP COLUMN IF EXISTS region,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS last_used;
