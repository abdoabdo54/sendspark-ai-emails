
export interface MiddlewareConfig {
  appsScriptExecUrl: string;
  controlTableType: 'supabase';
  pollingInterval: number;
  maxConcurrency: number;
  enabled: boolean;
}

export interface MiddlewareStatus {
  isRunning: boolean;
  activeJobs: number;
  pausedJobs: number;
  completedJobs: number;
  failedJobs: number;
  errors: string[];
  lastProcessedAt?: string;
}

export interface EmailJob {
  id: string;
  campaign_id: string;
  recipient_email: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  from_name: string;
  from_email: string;
  status: 'pending' | 'active' | 'paused' | 'sent' | 'failed' | 'retry';
  scheduled_at?: string;
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  apps_script_response?: any;
  created_at: string;
  updated_at: string;
}
