
-- Add proxy configuration fields to powermta_servers table
ALTER TABLE powermta_servers 
ADD COLUMN IF NOT EXISTS proxy_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS proxy_host text,
ADD COLUMN IF NOT EXISTS proxy_port integer,
ADD COLUMN IF NOT EXISTS proxy_username text,
ADD COLUMN IF NOT EXISTS proxy_password text,
ADD COLUMN IF NOT EXISTS manual_overrides jsonb DEFAULT '{}'::jsonb;
