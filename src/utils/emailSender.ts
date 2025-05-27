
interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
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
    console.log('Sending email via SMTP function:', { to: toEmail, subject });
    
    const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/send-smtp-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6YXR4dHRhenh3cWF3ZWZ1bWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzE1NTAsImV4cCI6MjA2Mzg0NzU1MH0.2hJNt57jErh8GgjbXc8vNg94F0FFBZS7tXxmdQvRG_w`
      },
      body: JSON.stringify({
        config,
        emailData: {
          from: { email: fromEmail, name: fromName },
          to: toEmail,
          subject,
          html: htmlContent,
          text: textContent
        }
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✓ Email sent successfully via SMTP');
      if (result.logs) {
        console.log('SMTP Logs:', result.logs);
      }
      return { success: true, logs: result.logs };
    } else {
      console.error('✗ SMTP sending failed:', result.error);
      if (result.logs) {
        console.error('SMTP Error Logs:', result.logs);
      }
      return { success: false, error: result.error || 'SMTP sending failed', logs: result.logs };
    }
  } catch (error) {
    console.error('✗ SMTP error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testSMTPConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log('Testing SMTP connection:', { host: config.host, port: config.port });
    
    const response = await fetch('https://kzatxttazxwqawefumed.supabase.co/functions/v1/smtp-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6YXR4dHRhenh3cWF3ZWZ1bWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzE1NTAsImV4cCI6MjA2Mzg0NzU1MH0.2hJNt57jErh8GgjbXc8vNg94F0FFBZS7tXxmdQvRG_w`
      },
      body: JSON.stringify({ config })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✓ SMTP connection test successful');
      if (result.logs) {
        console.log('SMTP Test Logs:', result.logs);
      }
      return { success: true, logs: result.logs };
    } else {
      console.error('✗ SMTP connection test failed:', result.error);
      if (result.logs) {
        console.error('SMTP Test Error Logs:', result.logs);
      }
      return { success: false, error: result.error || 'Connection test failed', logs: result.logs };
    }
  } catch (error) {
    console.error('✗ SMTP test error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export function validateSMTPConfig(config: SMTPConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.host) errors.push('SMTP host is required');
  if (!config.port || config.port < 1 || config.port > 65535) errors.push('Valid SMTP port is required');
  if (!config.username) errors.push('SMTP username is required');
  if (!config.password) errors.push('SMTP password is required');

  return {
    valid: errors.length === 0,
    errors
  };
}
