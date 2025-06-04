/*
  # Add RLS policies for organizations table

  1. Security Changes
    - Enable RLS on organizations table
    - Add policies for:
      - Authenticated users can create organizations
      - Users can read their own organizations
      - Users can update their own organizations
      - Users can delete their own organizations
*/

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create organizations
CREATE POLICY "Users can create organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to read their own organizations
CREATE POLICY "Users can read own organizations"
ON organizations
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = id
  )
);

-- Allow users to update their own organizations
CREATE POLICY "Users can update own organizations"
ON organizations
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = id
  )
);

-- Allow users to delete their own organizations
CREATE POLICY "Users can delete own organizations"
ON organizations
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM organization_members 
    WHERE organization_id = id
  )
);