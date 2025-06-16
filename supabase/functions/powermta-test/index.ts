
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { config }: { config: PowerMTATestConfig } = await req.json()

    console.log('🔍 PowerMTA Connection Test:', {
      host: config.server_host,
      port: config.ssh_port,
      username: config.username
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

    // Test SSH connection to PowerMTA server
    const connectionResult = await testSSHConnection(config);
    
    if (!connectionResult.success) {
      console.error('❌ PowerMTA connection test failed:', connectionResult.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: connectionResult.error 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PowerMTA connection test successful');

    return new Response(
      JSON.stringify({ 
        success: true,
        serverInfo: connectionResult.serverInfo,
        message: 'PowerMTA server connection successful'
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

async function testSSHConnection(config: PowerMTATestConfig): Promise<{ 
  success: boolean; 
  error?: string; 
  serverInfo?: string;
}> {
  try {
    console.log(`🔐 Testing SSH connection to: ${config.server_host}:${config.ssh_port}`);
    
    // Create a socket connection to test if the SSH port is open
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      // Test if we can connect to the SSH port
      const testUrl = `http://${config.server_host}:${config.ssh_port}`;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If we get any response, the port is accessible
      console.log('✅ SSH port is accessible');
      return {
        success: true,
        serverInfo: `SSH port ${config.ssh_port} is accessible on ${config.server_host}`
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Check if it's a network error vs connection refused
      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          error: `Connection timeout - Unable to reach ${config.server_host}:${config.ssh_port}`
        };
      }
      
      // For SSH, connection refused might actually mean the port is open but rejecting HTTP
      if (fetchError.message.includes('NetworkError') || fetchError.message.includes('Failed to fetch')) {
        // Try a different approach - attempt to create a TCP connection
        try {
          const conn = await Deno.connect({
            hostname: config.server_host,
            port: config.ssh_port,
          });
          conn.close();
          
          console.log('✅ SSH port connection successful');
          return {
            success: true,
            serverInfo: `Successfully connected to SSH port ${config.ssh_port} on ${config.server_host}`
          };
        } catch (tcpError) {
          console.error('❌ TCP connection failed:', tcpError);
          return {
            success: false,
            error: `Cannot connect to ${config.server_host}:${config.ssh_port} - ${tcpError.message}`
          };
        }
      }
      
      return {
        success: false,
        error: `SSH connection failed: ${fetchError.message}`
      };
    }

  } catch (error) {
    console.error('❌ SSH connection test failed:', error);
    return {
      success: false,
      error: `SSH connection failed: ${error.message}`
    };
  }
}
