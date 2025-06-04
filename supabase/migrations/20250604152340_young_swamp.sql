/*
  # Organization Members Schema Setup

  1. New Tables
    - `organization_members`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid)
      - `role` (text)
      - `joined_at` (timestamp)
      - `is_active` (boolean)

  2. Security
    - Enable RLS on organization_members table
    - Add policies for member management
*/

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read organization members
CREATE POLICY "Users can read organization members"
ON organization_members
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = organization_members.organization_id
  )
);

-- Allow authenticated users to insert themselves as members
CREATE POLICY "Users can insert themselves as members"
ON organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Allow users to update members in their organizations
CREATE POLICY "Users can update organization members"
ON organization_members
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = organization_members.organization_id
    AND role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = organization_members.organization_id
    AND role = 'admin'
  )
);

-- Allow admins to delete members
CREATE POLICY "Admins can delete members"
ON organization_members
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = organization_members.organization_id
    AND role = 'admin'
  )
);

-- Create function to automatically add creator as admin member
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to add creator as admin member
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_organization();