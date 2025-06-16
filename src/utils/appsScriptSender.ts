
interface AppsScriptConfig {
  exec_url: string;
  daily_quota: number;
}

interface AppsScriptResponse {
  success: boolean;
  error?: string;
  message?: string;
  quota_used?: number;
  quota_remaining?: number;
  remainingQuota?: number; // Add this for compatibility
}

export async function testAppsScriptConnection(config: AppsScriptConfig): Promise<AppsScriptResponse> {
  try {
    console.log('🔗 Testing Apps Script connection...');
    
    const testPayload = {
      test_connection: true,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(config.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      throw new Error(`Apps Script HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      message: 'Connection test successful',
      quota_remaining: result.quota_remaining || result.remainingQuota,
      remainingQuota: result.quota_remaining || result.remainingQuota
    };
  } catch (error) {
    console.error('❌ Apps Script connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}

export async function sendEmailViaAppsScript(
  config: AppsScriptConfig,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent?: string,
  textContent?: string
): Promise<AppsScriptResponse> {
  try {
    console.log(`📧 Sending email via Apps Script to ${toEmail}`);
    
    const payload = {
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject: subject,
      html_content: htmlContent || textContent,
      text_content: textContent
    };

    const response = await fetch(config.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Apps Script HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Apps Script success for ${toEmail}`);
      return {
        success: true,
        message: result.message || 'Email sent successfully',
        quota_used: result.quota_used,
        quota_remaining: result.quota_remaining,
        remainingQuota: result.quota_remaining
      };
    } else {
      console.log(`❌ Apps Script failed for ${toEmail}: ${result.error}`);
      return {
        success: false,
        error: result.error || 'Apps Script sending failed'
      };
    }
  } catch (error) {
    console.error(`❌ Apps Script error for ${toEmail}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
