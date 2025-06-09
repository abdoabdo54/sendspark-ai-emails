
-- Add missing columns to email_campaigns table
ALTER TABLE public.email_campaigns 
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
