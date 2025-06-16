interface PowerMTAConfig {
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
}

interface PowerMTACampaignData {
  campaignId: string;
  subject: string;
  html_content: string;
  text_content: string;
  from_name: string;
  prepared_emails: Array<{
    to: string;
    from_name: string;
    subject: string;
    prepared_at: string;
    rotation_index: number;
  }>;
  sender_accounts: Array<{
    id: string;
    name: string;
    type: 'smtp' | 'apps-script';
    email: string;
    config: any;
  }>;
}

export async function testPowerMTAConnection(config: PowerMTAConfig): Promise<{ success: boolean; error?: string; serverInfo?: string }> {
  try {
    console.log('🔍 Testing PowerMTA connection:', { 
      host: config.server_host, 
      port: config.ssh_port,
      username: config.username
    });
    
    // Validate configuration first
    const validation = validatePowerMTAConfig(config);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Configuration error: ${validation.errors.join(', ')}`
      };
    }
    
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data, error } = await supabase.functions.invoke('powermta-test', {
      body: {
        config: {
          server_host: config.server_host,
          ssh_port: config.ssh_port,
          username: config.username,
          password: config.password,
          api_port: config.api_port || 8080
        }
      }
    });

    if (error) {
      console.error('❌ PowerMTA Test Error:', error);
      return { 
        success: false, 
        error: error.message || 'PowerMTA test failed'
      };
    }

    if (data && data.success) {
      console.log('✅ PowerMTA connection successful');
      return { 
        success: true, 
        serverInfo: data.serverInfo || 'Connected successfully'
      };
    } else {
      console.error('❌ PowerMTA test failed:', data);
      return { 
        success: false, 
        error: data?.error || 'PowerMTA connection failed'
      };
    }
  } catch (error) {
    console.error('❌ PowerMTA test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function pushCampaignToPowerMTA(
  powerMTAConfig: PowerMTAConfig,
  campaignData: PowerMTACampaignData
): Promise<{ success: boolean; error?: string; queueId?: string }> {
  try {
    console.log('📤 Pushing campaign to PowerMTA:', { 
      server: powerMTAConfig.server_host,
      campaignId: campaignData.campaignId,
      emailCount: campaignData.prepared_emails.length,
      accountCount: campaignData.sender_accounts.length
    });
    
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Prepare sender accounts for PowerMTA format
    const formattedAccounts = campaignData.sender_accounts.map(account => {
      if (account.type === 'apps-script') {
        // Extract deployment ID from Apps Script URL
        const scriptUrl = account.config?.exec_url || account.config?.script_url || '';
        const deploymentMatch = scriptUrl.match(/\/s\/([A-Za-z0-9_-]+)\//);
        const deploymentId = deploymentMatch ? deploymentMatch[1] : '';
        
        return {
          id: account.id,
          name: account.name,
          type: 'apps-script',
          email: account.email,
          deployment_id: deploymentId,
          api_key: account.config?.api_key || ''
        };
      } else if (account.type === 'smtp') {
        return {
          id: account.id,
          name: account.name,
          type: 'smtp',
          email: account.email,
          host: account.config?.host,
          port: account.config?.port || 587,
          username: account.config?.username || account.config?.user,
          password: account.config?.password || account.config?.pass,
          encryption: account.config?.security || account.config?.encryption || 'tls'
        };
      }
      return null;
    }).filter(Boolean);

    console.log('📧 Formatted accounts for PowerMTA:', {
      totalAccounts: formattedAccounts.length,
      smtpAccounts: formattedAccounts.filter(a => a.type === 'smtp').length,
      appsScriptAccounts: formattedAccounts.filter(a => a.type === 'apps-script').length
    });

    const payload = {
      powermta_config: {
        server_host: powerMTAConfig.server_host,
        ssh_port: powerMTAConfig.ssh_port,
        username: powerMTAConfig.username,
        password: powerMTAConfig.password,
        api_port: powerMTAConfig.api_port || 8080,
        virtual_mta: powerMTAConfig.virtual_mta || 'default',
        job_pool: powerMTAConfig.job_pool || 'default'
      },
      campaign_data: {
        campaign_id: campaignData.campaignId,
        subject: campaignData.subject,
        html_content: campaignData.html_content,
        text_content: campaignData.text_content,
        from_name: campaignData.from_name,
        prepared_emails: campaignData.prepared_emails,
        sender_accounts: formattedAccounts
      }
    };

    console.log('📤 Sending payload to PowerMTA edge function...');

    const { data, error } = await supabase.functions.invoke('push-to-powermta', {
      body: payload
    });

    if (error) {
      console.error('❌ PowerMTA Push Error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to push campaign to PowerMTA'
      };
    }

    if (data && data.success) {
      console.log('✅ Campaign successfully pushed to PowerMTA');
      return { 
        success: true, 
        queueId: data.queueId || data.queue_id
      };
    } else {
      console.error('❌ PowerMTA push failed:', data);
      return { 
        success: false, 
        error: data?.error || 'PowerMTA campaign push failed'
      };
    }
  } catch (error) {
    console.error('❌ PowerMTA push error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function validatePowerMTAConfig(config: PowerMTAConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('PowerMTA server name is required');
  }
  
  if (!config.server_host || config.server_host.trim() === '') {
    errors.push('PowerMTA server host/IP is required');
  }
  
  // Validate IP address or domain format
  const hostPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z]{2,}$/;
  if (config.server_host && !hostPattern.test(config.server_host)) {
    errors.push('Invalid server host format (use IP address or domain name)');
  }
  
  if (!config.ssh_port || config.ssh_port < 1 || config.ssh_port > 65535) {
    errors.push('Valid SSH port is required (1-65535)');
  }
  
  if (!config.username || config.username.trim() === '') {
    errors.push('SSH username is required');
  }
  
  if (!config.password || config.password.trim() === '') {
    errors.push('SSH password is required');
  }

  if (config.api_port && (config.api_port < 1 || config.api_port > 65535)) {
    errors.push('Valid API port is required (1-65535)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
