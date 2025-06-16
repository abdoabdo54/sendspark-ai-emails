
export interface AppsScriptAccount {
  exec_url: string;
  daily_quota: number;
}

export interface AppsScriptResponse {
  success: boolean;
  error?: string;
  quota_remaining?: number;
  remainingQuota?: number;
  sent_at?: string;
}

export const testAppsScriptConnection = async (
  account: AppsScriptAccount
): Promise<AppsScriptResponse> => {
  try {
    console.log(`🔌 Testing Apps Script connection to ${account.exec_url}`);
    
    const response = await fetch(account.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test'
      })
    });

    if (!response.ok) {
      throw new Error(`Apps Script API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        quota_remaining: result.quota_remaining,
        remainingQuota: result.quota_remaining
      };
    } else {
      return {
        success: false,
        error: result.error || 'Apps Script connection test failed'
      };
    }
  } catch (error) {
    console.error('Apps Script connection test error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const sendEmailViaAppsScript = async (
  account: AppsScriptAccount,
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<AppsScriptResponse> => {
  try {
    console.log(`📧 Sending email via Apps Script to ${toEmail}`);
    
    const response = await fetch(account.exec_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendEmail',
        fromEmail,
        fromName,
        toEmail,
        subject,
        htmlContent,
        textContent: textContent || htmlContent
      })
    });

    if (!response.ok) {
      throw new Error(`Apps Script API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        quota_remaining: result.quota_remaining,
        remainingQuota: result.quota_remaining,
        sent_at: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: result.error || 'Apps Script sending failed'
      };
    }
  } catch (error) {
    console.error('Apps Script sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
