
-- Create email_jobs table for PowerMTA middleware
CREATE TABLE public.email_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'sent', 'failed', 'retry')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  apps_script_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view jobs in their organization's campaigns
CREATE POLICY "Users can view email jobs in their organization" 
  ON public.email_jobs 
  FOR SELECT 
  USING (
    campaign_id IN (
      SELECT id FROM public.email_campaigns 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.get_user_organization_ids_safe(auth.uid())
      )
    )
  );

-- Create policy for users to create email jobs in their organization
CREATE POLICY "Users can create email jobs in their organization" 
  ON public.email_jobs 
  FOR INSERT 
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.email_campaigns 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.get_user_organization_ids_safe(auth.uid())
      )
    )
  );

-- Create policy for users to update email jobs in their organization
CREATE POLICY "Users can update email jobs in their organization" 
  ON public.email_jobs 
  FOR UPDATE 
  USING (
    campaign_id IN (
      SELECT id FROM public.email_campaigns 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.get_user_organization_ids_safe(auth.uid())
      )
    )
  );

-- Create policy for users to delete email jobs in their organization
CREATE POLICY "Users can delete email jobs in their organization" 
  ON public.email_jobs 
  FOR DELETE 
  USING (
    campaign_id IN (
      SELECT id FROM public.email_campaigns 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.get_user_organization_ids_safe(auth.uid())
      )
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_email_jobs_updated_at
  BEFORE UPDATE ON public.email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_email_jobs_campaign_id ON public.email_jobs(campaign_id);
CREATE INDEX idx_email_jobs_status ON public.email_jobs(status);
CREATE INDEX idx_email_jobs_created_at ON public.email_jobs(created_at);
CREATE INDEX idx_email_jobs_campaign_status ON public.email_jobs(campaign_id, status);
