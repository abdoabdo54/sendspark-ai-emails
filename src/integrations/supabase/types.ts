export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      automation_steps: {
        Row: {
          created_at: string
          email_template_id: string | null
          id: string
          step_config: Json | null
          step_order: number
          step_type: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          email_template_id?: string | null
          id?: string
          step_config?: Json | null
          step_order: number
          step_type: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          email_template_id?: string | null
          id?: string
          step_config?: Json | null
          step_order?: number
          step_type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_analytics: {
        Row: {
          campaign_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          subscriber_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          subscriber_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          subscriber_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_analytics_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          bounces: number | null
          campaign_id: string | null
          clicks: number | null
          created_at: string
          delivered: number | null
          forwards: number | null
          id: string
          opens: number | null
          spam_complaints: number | null
          unique_clicks: number | null
          unique_opens: number | null
          unsubscribes: number | null
        }
        Insert: {
          bounces?: number | null
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          delivered?: number | null
          forwards?: number | null
          id?: string
          opens?: number | null
          spam_complaints?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
          unsubscribes?: number | null
        }
        Update: {
          bounces?: number | null
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          delivered?: number | null
          forwards?: number | null
          id?: string
          opens?: number | null
          spam_complaints?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
          unsubscribes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          dns_records: Json | null
          domain_name: string
          id: string
          is_verified: boolean | null
          namecheap_config: Json | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dns_records?: Json | null
          domain_name: string
          id?: string
          is_verified?: boolean | null
          namecheap_config?: Json | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dns_records?: Json | null
          domain_name?: string
          id?: string
          is_verified?: boolean | null
          namecheap_config?: Json | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          config: Json | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string
          error_message: string | null
          from_name: string
          html_content: string | null
          id: string
          organization_id: string | null
          prepared_emails: Json | null
          recipients: string
          send_method: string
          sent_at: string | null
          sent_count: number | null
          status: string | null
          subject: string
          text_content: string | null
          total_recipients: number | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          error_message?: string | null
          from_name: string
          html_content?: string | null
          id?: string
          organization_id?: string | null
          prepared_emails?: Json | null
          recipients: string
          send_method: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject: string
          text_content?: string | null
          total_recipients?: number | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          error_message?: string | null
          from_name?: string
          html_content?: string | null
          id?: string
          organization_id?: string | null
          prepared_emails?: Json | null
          recipients?: string
          send_method?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string
          text_content?: string | null
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          apps_script_response: Json | null
          campaign_id: string
          created_at: string
          error_message: string | null
          from_email: string
          from_name: string
          html_content: string | null
          id: string
          max_retries: number
          recipient_email: string
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          text_content: string | null
          updated_at: string
        }
        Insert: {
          apps_script_response?: Json | null
          campaign_id: string
          created_at?: string
          error_message?: string | null
          from_email: string
          from_name: string
          html_content?: string | null
          id?: string
          max_retries?: number
          recipient_email: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          apps_script_response?: Json | null
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          from_email?: string
          from_name?: string
          html_content?: string | null
          id?: string
          max_retries?: number
          recipient_email?: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          text_content?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_lists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          subscriber_count: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          subscriber_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          subscriber_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          html_content: string | null
          id: string
          is_public: boolean | null
          name: string
          organization_id: string
          text_content: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          html_content?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          organization_id: string
          text_content?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          html_content?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          organization_id?: string
          text_content?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gcf_functions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          organization_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      list_subscribers: {
        Row: {
          id: string
          list_id: string
          status: string | null
          subscribed_at: string | null
          subscriber_id: string
          unsubscribed_at: string | null
        }
        Insert: {
          id?: string
          list_id: string
          status?: string | null
          subscribed_at?: string | null
          subscriber_id: string
          unsubscribed_at?: string | null
        }
        Update: {
          id?: string
          list_id?: string
          status?: string | null
          subscribed_at?: string | null
          subscriber_id?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_subscribers_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_subscribers_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          id: string
          invited_at: string | null
          is_active: boolean | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          emails_sent_this_month: number | null
          id: string
          is_active: boolean | null
          monthly_email_limit: number | null
          name: string
          settings: Json | null
          subdomain: string
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          emails_sent_this_month?: number | null
          id?: string
          is_active?: boolean | null
          monthly_email_limit?: number | null
          name: string
          settings?: Json | null
          subdomain: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          emails_sent_this_month?: number | null
          id?: string
          is_active?: boolean | null
          monthly_email_limit?: number | null
          name?: string
          settings?: Json | null
          subdomain?: string
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      powermta_servers: {
        Row: {
          api_port: number | null
          created_at: string
          id: string
          is_active: boolean
          job_pool: string | null
          manual_overrides: Json | null
          name: string
          organization_id: string
          password: string
          proxy_enabled: boolean | null
          proxy_host: string | null
          proxy_password: string | null
          proxy_port: number | null
          proxy_username: string | null
          server_host: string
          ssh_port: number
          updated_at: string
          username: string
          virtual_mta: string | null
        }
        Insert: {
          api_port?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_pool?: string | null
          manual_overrides?: Json | null
          name: string
          organization_id: string
          password: string
          proxy_enabled?: boolean | null
          proxy_host?: string | null
          proxy_password?: string | null
          proxy_port?: number | null
          proxy_username?: string | null
          server_host: string
          ssh_port?: number
          updated_at?: string
          username: string
          virtual_mta?: string | null
        }
        Update: {
          api_port?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          job_pool?: string | null
          manual_overrides?: Json | null
          name?: string
          organization_id?: string
          password?: string
          proxy_enabled?: boolean | null
          proxy_host?: string | null
          proxy_password?: string | null
          proxy_port?: number | null
          proxy_username?: string | null
          server_host?: string
          ssh_port?: number
          updated_at?: string
          username?: string
          virtual_mta?: string | null
        }
        Relationships: []
      }
      servers: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          organization_id: string
          port: number | null
          server_config: Json | null
          server_name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: unknown
          organization_id: string
          port?: number | null
          server_config?: Json | null
          server_name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          port?: number | null
          server_config?: Json | null
          server_name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          custom_fields: Json | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          phone: string | null
          source: string | null
          status: string | null
          subscribed_at: string | null
          tags: string[] | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id: string
          phone?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_lists: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_user: {
        Args: {
          user_id_param: string
          org_name: string
          org_subdomain: string
          org_domain?: string
        }
        Returns: string
      }
      get_user_organization_ids: {
        Args: { user_id_param: string }
        Returns: {
          organization_id: string
        }[]
      }
      get_user_organization_ids_safe: {
        Args: { user_id_param: string }
        Returns: {
          organization_id: string
        }[]
      }
      get_user_organizations: {
        Args: { user_id: string }
        Returns: {
          org_id: string
          org_role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_organizations_with_roles: {
        Args: { user_id_param: string }
        Returns: {
          org_id: string
          org_name: string
          org_subdomain: string
          org_domain: string
          subscription_plan: string
          is_active: boolean
          monthly_email_limit: number
          emails_sent_this_month: number
          user_role: string
          created_at: string
        }[]
      }
      user_has_role_in_org: {
        Args: {
          user_id_param: string
          org_id_param: string
          required_roles: string[]
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role:
        | "super_admin"
        | "org_admin"
        | "campaign_manager"
        | "content_creator"
        | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: [
        "super_admin",
        "org_admin",
        "campaign_manager",
        "content_creator",
        "viewer",
      ],
    },
  },
} as const
