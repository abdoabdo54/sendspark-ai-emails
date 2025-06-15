interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
  security?: 'none' | 'tls' | 'ssl';
  use_auth?: boolean;
}

export async function sendEmailViaSMTP(
  config: SMTPConfig,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    // Explicitly log config details (do not log credentials)
    console.log('[SMTP-Test] sendEmailViaSMTP with:', {
      host: config.host,
      port: config.port,
      security: config.encryption || config.security,
      use_auth: config.auth_required !== false && config.use_auth !== false,
      username_set: !!config.username
    });

    // Always forward both encryption and security fields, and both auth_required and use_auth
    const { supabase } = await import('@/integrations/supabase/client');
    
    const emailData = {
      from: { email: fromEmail, name: fromName },
      to: toEmail,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent?.replace(/<[^>]*>/g, '') || ''
    };

    const { data, error } = await supabase.functions.invoke('send-smtp-email', {
      body: {
        config: {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          encryption: config.encryption || config.security || 'tls',
          security: config.security || config.encryption || 'tls',
          auth_required: config.auth_required !== false,
          use_auth: config.use_auth !== false // Make sure it's not undefined
        },
        emailData: emailData
      }
    });

    if (error) {
      console.error('❌ [SMTP-Test] SMTP Edge Function Error:', error);
      return {
        success: false,
        error: error.message || 'SMTP edge function failed',
        logs: [`❌ Edge function error: ${error.message}`]
      };
    }

    if (data && data.success) {
      console.log('✅ [SMTP-Test] SMTP Email sent successfully via edge function');
      return {
        success: true,
        logs: data.logs || ['✅ Email sent successfully via SMTP edge function']
      };
    } else {
      console.error('❌ [SMTP-Test] SMTP sending failed:', data);
      return {
        success: false,
        error: data?.error || 'SMTP sending failed',
        logs: data?.logs || [`❌ SMTP error: ${data?.error || 'Unknown error'}`]
      };
    }
  } catch (error) {
    console.error('❌ [SMTP-Test] SMTP function error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: [`❌ Fatal SMTP error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

export async function testSMTPConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log('🔍 Testing SMTP connection:', { 
      host: config.host, 
      port: config.port,
      encryption: config.encryption || config.security
    });
    
    // Use Supabase Edge Function for SMTP testing
    const { supabase } = await import('@/integrations/supabase/client');
    
    console.log('🔍 Calling SMTP test edge function');

    const { data, error } = await supabase.functions.invoke('smtp-test', {
      body: {
        config: {
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          encryption: config.encryption || config.security || 'tls',
          auth_required: config.auth_required !== false
        }
      }
    });

    if (error) {
      console.error('❌ SMTP Test Edge Function Error:', error);
      return { 
        success: false, 
        error: error.message || 'SMTP test edge function failed',
        logs: [`❌ Edge function error: ${error.message}`]
      };
    }

    if (data) {
      console.log('📋 SMTP Test Result:', data);
      return {
        success: data.success || false,
        error: data.error,
        logs: data.logs || []
      };
    } else {
      return { 
        success: false, 
        error: 'No response from SMTP test function',
        logs: ['❌ No response from SMTP test function']
      };
    }
  } catch (error) {
    console.error('❌ SMTP test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: [`❌ SMTP test error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

export function validateSMTPConfig(config: SMTPConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.host || config.host.trim() === '') {
    errors.push('SMTP host is required');
  }
  
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Valid SMTP port is required (1-65535)');
  }
  
  if (config.auth_required !== false && config.use_auth !== false) {
    if (!config.username || config.username.trim() === '') {
      errors.push('SMTP username is required when authentication is enabled');
    }
    if (!config.password || config.password.trim() === '') {
      errors.push('SMTP password is required when authentication is enabled');
    }
  }

  // Validate encryption setting
  const validEncryptions = ['none', 'tls', 'ssl'];
  const encryption = config.encryption || config.security || 'tls';
  if (!validEncryptions.includes(encryption)) {
    errors.push('Invalid encryption setting. Must be none, tls, or ssl');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
