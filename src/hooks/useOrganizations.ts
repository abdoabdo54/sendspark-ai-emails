
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
  subdomain: string;
  domain?: string;
  is_active: boolean;
  monthly_email_limit: number;
  emails_sent_this_month: number;
}

export const useOrganizations = () => {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Create a default demo organization with proper UUID
  const createDemoOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert([{
          name: 'Demo Organization',
          subdomain: 'demo-org',
          subscription_plan: 'pro',
          is_active: true,
          monthly_email_limit: 10000,
          emails_sent_this_month: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating demo organization:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating demo organization:', error);
      return null;
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        // Create demo organization if none exists
        const demoOrg = await createDemoOrganization();
        if (demoOrg) {
          setOrganizations([demoOrg]);
          setCurrentOrganization(demoOrg);
        }
      } else {
        setOrganizations(data);
        setCurrentOrganization(data[0]);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (orgData: {
    name: string;
    subdomain: string;
    domain?: string;
  }) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('organizations')
        .insert([{
          ...orgData,
          subscription_plan: 'free',
          is_active: true,
          monthly_email_limit: 1000,
          emails_sent_this_month: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setOrganizations(prev => [...prev, data]);
      setCurrentOrganization(data);
      
      toast({
        title: "Success",
        description: "Organization created successfully"
      });
      
      return data;
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return {
    currentOrganization,
    organizations,
    loading,
    createOrganization,
    refetch: fetchOrganizations
  };
};
