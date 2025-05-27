
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
): Promise<{ success: boolean; error?: string }> {
  try {
    // For real SMTP sending, you would use a proper SMTP library
    // This is a simplified example using a web service
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        smtp: config,
        from: { email: fromEmail, name: fromName },
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent
      })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
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
