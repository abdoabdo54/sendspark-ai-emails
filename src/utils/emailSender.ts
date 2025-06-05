
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
    
    // Simulate SMTP sending in demo mode
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✓ Email sent successfully via SMTP (Demo Mode)');
    return { 
      success: true, 
      logs: [
        `Starting SMTP send to ${toEmail} via ${config.host}:${config.port}`,
        `Encryption: ${config.encryption}, Auth required: ${config.auth_required}`,
        'Using demo mode connection',
        '✓ Demo SMTP connection established',
        '✓ Authentication successful (Demo)',
        '✓ Email sent successfully'
      ]
    };
  } catch (error) {
    console.error('✗ SMTP error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: [`✗ SMTP error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

export async function testSMTPConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    console.log('Testing SMTP connection:', { host: config.host, port: config.port });
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('✓ SMTP connection test successful (Demo Mode)');
    return { 
      success: true, 
      logs: [
        `Testing SMTP connection to ${config.host}:${config.port}`,
        `Encryption: ${config.encryption}`,
        'Using demo mode connection',
        '✓ Demo connection established',
        '✓ Authentication test passed',
        '✓ Connection test successful'
      ]
    };
  } catch (error) {
    console.error('✗ SMTP test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: [`✗ SMTP test error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
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
