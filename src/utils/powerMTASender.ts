
interface PowerMTAConfig {
  name: string;
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port?: number;
  virtual_mta?: string;
  job_pool?: string;
  manual_overrides?: Record<string, string>;
}

interface SenderAccount {
  id: string;
  name: string;
  type: 'smtp' | 'apps-script';
  email: string;
  config: any;
}

export async function testPowerMTAConnection(config: PowerMTAConfig): Promise<{ success: boolean; error?: string; serverInfo?: string }> {
  try {
    console.log('🔍 Testing PowerMTA SSH connection:', { 
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
      console.error('❌ PowerMTA SSH Test Error:', error);
      return { 
        success: false, 
        error: error.message || 'PowerMTA SSH test failed'
      };
    }

    if (data && data.success) {
      console.log('✅ PowerMTA SSH connection successful');
      return { 
        success: true, 
        serverInfo: data.serverInfo || 'SSH connection successful'
      };
    } else {
      console.error('❌ PowerMTA SSH test failed:', data);
      return { 
        success: false, 
        error: data?.error || 'PowerMTA SSH connection failed'
      };
    }
  } catch (error) {
    console.error('❌ PowerMTA SSH test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function pushSenderAccountsToServer(
  powerMTAConfig: PowerMTAConfig,
  senderAccounts: SenderAccount[]
): Promise<{ success: boolean; error?: string; configFiles?: string[] }> {
  try {
    console.log('📤 Pushing sender accounts to PowerMTA server:', { 
      server: powerMTAConfig.server_host,
      accountCount: senderAccounts.length,
      smtpAccounts: senderAccounts.filter(a => a.type === 'smtp').length,
      appsScriptAccounts: senderAccounts.filter(a => a.type === 'apps-script').length
    });
    
    const { supabase } = await import('@/integrations/supabase/client');
    
    const payload = {
      powermta_config: {
        server_host: powerMTAConfig.server_host,
        ssh_port: powerMTAConfig.ssh_port,
        username: powerMTAConfig.username,
        password: powerMTAConfig.password,
        api_port: powerMTAConfig.api_port || 8080,
        virtual_mta: powerMTAConfig.virtual_mta || 'default',
        job_pool: powerMTAConfig.job_pool || 'default',
        manual_overrides: powerMTAConfig.manual_overrides || {}
      },
      sender_accounts: senderAccounts
    };

    console.log('📤 Sending configuration to PowerMTA server...');

    const { data, error } = await supabase.functions.invoke('push-to-powermta', {
      body: payload
    });

    if (error) {
      console.error('❌ PowerMTA Configuration Push Error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to push configuration to PowerMTA server'
      };
    }

    if (data && data.success) {
      console.log('✅ Configuration successfully pushed to PowerMTA server');
      return { 
        success: true, 
        configFiles: data.configFiles || []
      };
    } else {
      console.error('❌ PowerMTA configuration push failed:', data);
      return { 
        success: false, 
        error: data?.error || 'PowerMTA configuration push failed'
      };
    }
  } catch (error) {
    console.error('❌ PowerMTA configuration push error:', error);
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
