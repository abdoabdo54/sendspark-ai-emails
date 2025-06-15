interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
  security?: 'none' | 'tls' | 'ssl';
  use_auth?: boolean;
  // Legacy fields for backward compatibility
  user?: string;
  pass?: string;
  secure?: boolean;
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
    console.log('📧 Sending email via SMTP function:', { 
      to: toEmail, 
      subject,
      host: config.host,
      port: config.port,
      encryption: config.encryption || config.security
    });
    
    // Use Supabase Edge Function for SMTP sending
    const { supabase } = await import('@/integrations/supabase/client');
    
    const emailData = {
      from: { email: fromEmail, name: fromName },
      to: toEmail,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent?.replace(/<[^>]*>/g, '') || ''
    };

    // Enhanced configuration mapping for better compatibility
    const smtpConfig = {
      host: config.host,
      port: config.port,
      // Handle both old and new field names
      username: config.username || config.user,
      password: config.password || config.pass,
      encryption: config.encryption || config.security || 'tls',
      auth_required: config.auth_required !== false && config.use_auth !== false,
      // Ensure backward compatibility
      security: config.security || config.encryption || 'tls',
      use_auth: config.use_auth !== false && config.auth_required !== false
    };

    console.log('📧 Calling SMTP edge function with enhanced config:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      username: smtpConfig.username,
      encryption: smtpConfig.encryption,
      auth_required: smtpConfig.auth_required
    });

    const { data, error } = await supabase.functions.invoke('send-smtp-email', {
      body: {
        config: smtpConfig,
        emailData: emailData
      }
    });

    if (error) {
      console.error('❌ SMTP Edge Function Error:', error);
      return { 
        success: false, 
        error: error.message || 'SMTP edge function failed',
        logs: [`❌ Edge function error: ${error.message}`]
      };
    }

    if (data && data.success) {
      console.log('✅ SMTP Email sent successfully via edge function');
      return { 
        success: true, 
        logs: data.logs || ['✅ Email sent successfully via SMTP edge function']
      };
    } else {
      console.error('❌ SMTP sending failed:', data);
      return { 
        success: false, 
        error: data?.error || 'SMTP sending failed',
        logs: data?.logs || [`❌ SMTP error: ${data?.error || 'Unknown error'}`]
      };
    }
  } catch (error) {
    console.error('❌ SMTP function error:', error);
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

    // Enhanced configuration for testing
    const testConfig = {
      host: config.host,
      port: config.port,
      // Handle both old and new field names
      username: config.username || config.user,
      password: config.password || config.pass,
      encryption: config.encryption || config.security || 'tls',
      auth_required: config.auth_required !== false && config.use_auth !== false,
      security: config.security || config.encryption || 'tls',
      use_auth: config.use_auth !== false && config.auth_required !== false
    };

    const { data, error } = await supabase.functions.invoke('smtp-test', {
      body: {
        config: testConfig
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
    const username = config.username || config.user;
    const password = config.password || config.pass;
    
    if (!username || username.trim() === '') {
      errors.push('SMTP username is required when authentication is enabled');
    }
    if (!password || password.trim() === '') {
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
