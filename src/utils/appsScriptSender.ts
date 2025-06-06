
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
    console.log('Sending email via Apps Script Web App:', { to: toEmail, subject });
    
    if (!config.exec_url) {
      throw new Error('Apps Script Web App execution URL is required');
    }
    
    const payload = {
      to: toEmail,
      subject: subject,
      htmlBody: htmlContent,
      plainBody: textContent || '',
      fromName: fromName,
      fromAlias: fromEmail,
      cc: cc || '',
      bcc: bcc || ''
    };

    console.log('Sending payload to Apps Script:', payload);

    // In demo mode, simulate the Apps Script call
    if (config.exec_url.includes('demo') || config.exec_url.includes('localhost')) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✓ Email sent successfully via Apps Script Web App (Demo Mode)');
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

    console.log('Apps Script response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('Apps Script response:', result);
      
      if (result.status === 'success') {
        console.log('✓ Email sent successfully via Apps Script Web App');
        return { 
          success: true, 
          remainingQuota: result.remainingQuota || 0
        };
      } else {
        console.error('✗ Apps Script error:', result.message);
        return { 
          success: false, 
          error: result.message || 'Apps Script Web App sending failed' 
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
    console.log('Testing Apps Script Web App connection:', config.exec_url);
    
    if (!config.exec_url) {
      throw new Error('Apps Script Web App execution URL is required');
    }
    
    // In demo mode, simulate the test
    if (config.exec_url.includes('demo') || config.exec_url.includes('localhost')) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('✓ Apps Script Web App connection test successful (Demo Mode)');
      return { 
        success: true, 
        remainingQuota: Math.floor(Math.random() * 100) + 50
      };
    }
    
    const response = await fetch(config.exec_url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Apps Script test response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('Apps Script test response:', result);
      
      if (result.status === 'success') {
        console.log('✓ Apps Script Web App connection test successful');
        return { 
          success: true, 
          remainingQuota: result.remainingQuota || 0
        };
      } else {
        console.error('✗ Apps Script status error:', result.message);
        return { 
          success: false, 
          error: result.message || 'Apps Script Web App connection failed' 
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
