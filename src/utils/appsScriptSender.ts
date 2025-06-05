
interface AppsScriptConfig {
  exec_url: string;
  script_id?: string;
  deployment_id?: string;
  daily_quota: number;
}

export async function sendEmailViaAppsScript(
  config: AppsScriptConfig,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  cc?: string,
  bcc?: string
): Promise<{ success: boolean; error?: string; remainingQuota?: number }> {
  try {
    console.log('Sending email via Apps Script:', { to: toEmail, subject });
    
    if (!config.exec_url) {
      throw new Error('Apps Script execution URL is required');
    }
    
    const payload = {
      to: toEmail,
      subject: subject,
      htmlBody: htmlContent,
      plainBody: textContent,
      fromName: fromName,
      fromAlias: fromEmail,
      cc: cc,
      bcc: bcc
    };

    // In demo mode, simulate the Apps Script call
    if (config.exec_url.includes('demo') || config.exec_url.includes('localhost')) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('✓ Email sent successfully via Apps Script (Demo Mode)');
      return { 
        success: true, 
        remainingQuota: Math.floor(Math.random() * 100) + 50
      };
    }

    const response = await fetch(config.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success') {
        console.log('✓ Email sent successfully via Apps Script');
        return { 
          success: true, 
          remainingQuota: result.remainingQuota 
        };
      } else {
        console.error('✗ Apps Script error:', result.message);
        return { 
          success: false, 
          error: result.message || 'Apps Script sending failed' 
        };
      }
    } else {
      const errorText = await response.text();
      console.error('✗ Apps Script HTTP error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      };
    }
  } catch (error) {
    console.error('✗ Apps Script error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function testAppsScriptConnection(config: AppsScriptConfig): Promise<{ success: boolean; error?: string; remainingQuota?: number }> {
  try {
    console.log('Testing Apps Script connection:', config.exec_url);
    
    if (!config.exec_url) {
      throw new Error('Apps Script execution URL is required');
    }
    
    // In demo mode, simulate the test
    if (config.exec_url.includes('demo') || config.exec_url.includes('localhost')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✓ Apps Script connection test successful (Demo Mode)');
      return { 
        success: true, 
        remainingQuota: Math.floor(Math.random() * 100) + 50
      };
    }
    
    const response = await fetch(`${config.exec_url}?action=status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success') {
        console.log('✓ Apps Script connection test successful');
        return { 
          success: true, 
          remainingQuota: result.remainingQuota 
        };
      } else {
        console.error('✗ Apps Script status error:', result.message);
        return { 
          success: false, 
          error: result.message || 'Apps Script connection failed' 
        };
      }
    } else {
      const errorText = await response.text();
      console.error('✗ Apps Script HTTP error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      };
    }
  } catch (error) {
    console.error('✗ Apps Script test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
