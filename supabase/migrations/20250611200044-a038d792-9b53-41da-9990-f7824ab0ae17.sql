
-- Create table for Google Cloud Function management
CREATE TABLE public.gcf_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  region TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.gcf_functions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view functions in their organization
CREATE POLICY "Users can view functions in their organization" 
  ON public.gcf_functions 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Create policy for users to insert functions in their organization
CREATE POLICY "Users can create functions in their organization" 
  ON public.gcf_functions 
  FOR INSERT 
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

-- Create policy for users to update functions in their organization
CREATE POLICY "Users can update functions in their organization" 
  ON public.gcf_functions 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

-- Create policy for users to delete functions in their organization
CREATE POLICY "Users can delete functions in their organization" 
  ON public.gcf_functions 
  FOR DELETE 
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'editor')
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_gcf_functions_updated_at
  BEFORE UPDATE ON public.gcf_functions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_gcf_functions_organization_enabled 
  ON public.gcf_functions(organization_id, enabled);
