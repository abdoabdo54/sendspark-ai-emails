
export interface MiddlewareConfig {
  appsScriptExecUrl: string;
  controlTableType: 'supabase' | 'google_sheets';
  controlTableId?: string; // For Google Sheets
  pollingInterval: number; // milliseconds
  maxConcurrency: number;
  enabled: boolean;
}

export interface EmailJob {
  id: string;
  campaign_id: string;
  recipient_email: string;
  subject: string;
  html_content: string;
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

export interface MiddlewareStatus {
  isRunning: boolean;
  activeJobs: number;
  pausedJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastProcessedAt?: string;
  errors: string[];
}
