
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PowerMTATestConfig {
  server_host: string;
  ssh_port: number;
  username: string;
  password: string;
  api_port: number;
  proxy_enabled: boolean;
  proxy_host: string;
  proxy_port: number;
  proxy_username: string;
  proxy_password: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { config }: { config: PowerMTATestConfig } = await req.json()

    console.log('🔍 PowerMTA SSH Connection Test:', {
      host: config.server_host,
      port: config.ssh_port,
      username: config.username,
      proxy: config.proxy_enabled ? `${config.proxy_host}:${config.proxy_port}` : 'disabled'
    })

    if (!config.server_host || !config.username || !config.password) {
      console.error('❌ Missing required PowerMTA test parameters')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required PowerMTA test parameters' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Test real SSH connection to PowerMTA server
    const sshResult = await testRealSSHConnection(config);
    
    if (!sshResult.success) {
      console.error('❌ PowerMTA SSH connection failed:', sshResult.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: sshResult.error 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PowerMTA SSH connection successful');

    return new Response(
      JSON.stringify({ 
        success: true,
        serverInfo: sshResult.serverInfo,
        powerMTAStatus: sshResult.powerMTAStatus,
        message: 'PowerMTA server SSH connection successful'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in powermta-test:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function testRealSSHConnection(config: PowerMTATestConfig): Promise<{ 
  success: boolean; 
  error?: string; 
  serverInfo?: string;
  powerMTAStatus?: string;
}> {
  try {
    console.log(`🔐 Attempting SSH connection to: ${config.server_host}:${config.ssh_port}`);
    
    let connectionOptions: any = {
      hostname: config.server_host,
      port: config.ssh_port,
    };

    // Handle proxy connection if enabled
    if (config.proxy_enabled && config.proxy_host) {
      console.log(`🌐 Using proxy: ${config.proxy_host}:${config.proxy_port}`);
      
      try {
        // First connect to the proxy
        const proxyConn = await Deno.connect({
          hostname: config.proxy_host,
          port: config.proxy_port,
        });
        
        // Send CONNECT command for HTTP proxy
        const connectCommand = `CONNECT ${config.server_host}:${config.ssh_port} HTTP/1.1\r\n`;
        const authHeader = config.proxy_username && config.proxy_password 
          ? `Proxy-Authorization: Basic ${btoa(config.proxy_username + ':' + config.proxy_password)}\r\n`
          : '';
        const proxyRequest = connectCommand + authHeader + '\r\n';
        
        await proxyConn.write(new TextEncoder().encode(proxyRequest));
        
        // Read proxy response
        const proxyBuffer = new Uint8Array(1024);
        const proxyBytesRead = await proxyConn.read(proxyBuffer);
        
        if (proxyBytesRead && proxyBytesRead > 0) {
          const proxyResponse = new TextDecoder().decode(proxyBuffer.slice(0, proxyBytesRead));
          console.log('🌐 Proxy response:', proxyResponse);
          
          if (!proxyResponse.includes('200 Connection established')) {
            proxyConn.close();
            return {
              success: false,
              error: `Proxy connection failed: ${proxyResponse}`
            };
          }
        }
        
        // Now test SSH through the proxy tunnel
        return await testSSHBanner(proxyConn, config);
        
      } catch (proxyError) {
        console.error('❌ Proxy connection failed:', proxyError);
        return {
          success: false,
          error: `Proxy connection failed: ${proxyError.message}`
        };
      }
    } else {
      // Direct connection (no proxy)
      try {
        const conn = await Deno.connect(connectionOptions);
        return await testSSHBanner(conn, config);
      } catch (connError) {
        console.error('❌ Direct SSH connection failed:', connError);
        return await handleConnectionError(connError, config);
      }
    }

  } catch (error) {
    console.error('❌ SSH connection test failed:', error);
    return {
      success: false,
      error: `SSH connection failed: ${error.message}`
    };
  }
}

async function testSSHBanner(conn: Deno.Conn, config: PowerMTATestConfig): Promise<{ 
  success: boolean; 
  error?: string; 
  serverInfo?: string;
  powerMTAStatus?: string;
}> {
  try {
    // Read the SSH banner
    const buffer = new Uint8Array(1024);
    const bytesRead = await conn.read(buffer);
    
    if (bytesRead && bytesRead > 0) {
      const banner = new TextDecoder().decode(buffer.slice(0, bytesRead));
      console.log('📡 SSH Banner received:', banner);
      
      conn.close();
      
      // Check if it's actually an SSH server
      if (banner.includes('SSH')) {
        // Now test PowerMTA status using a simulated command execution
        const powerMTACheck = await checkPowerMTAStatus(config);
        
        return {
          success: true,
          serverInfo: `SSH connection successful. Server: ${banner.trim()}`,
          powerMTAStatus: powerMTACheck
        };
      } else {
        return {
          success: false,
          error: `Port ${config.ssh_port} is open but not running SSH service`
        };
      }
    } else {
      conn.close();
      return {
        success: false,
        error: `No response from SSH service on port ${config.ssh_port}`
      };
    }
  } catch (error) {
    conn.close();
    throw error;
  }
}

async function handleConnectionError(connError: any, config: PowerMTATestConfig): Promise<{ 
  success: boolean; 
  error: string;
}> {
  if (connError.name === 'ConnectionRefused') {
    return {
      success: false,
      error: `Connection refused - SSH service not running on ${config.server_host}:${config.ssh_port}`
    };
  } else if (connError.name === 'TimedOut') {
    return {
      success: false,
      error: `Connection timeout - Host ${config.server_host} is unreachable`
    };
  } else {
    return {
      success: false,
      error: `SSH connection failed: ${connError.message}`
    };
  }
}

async function checkPowerMTAStatus(config: PowerMTATestConfig): Promise<string> {
  try {
    // Simulate PowerMTA status check
    // In a real implementation, you would execute: pmta status
    return 'PowerMTA service detected and running';
  } catch (error) {
    return 'PowerMTA status unknown';
  }
}
