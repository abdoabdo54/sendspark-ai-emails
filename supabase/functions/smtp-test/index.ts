
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'tls' | 'ssl';
  auth_required: boolean;
}

async function testSMTPConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Testing SMTP connection to ${config.host}:${config.port}`);
    
    // Create connection to SMTP server
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Read initial response
    const buffer = new Uint8Array(1024);
    const bytesRead = await conn.read(buffer);
    const response = decoder.decode(buffer.subarray(0, bytesRead || 0));
    console.log("Initial response:", response);
    
    if (!response.startsWith('220')) {
      conn.close();
      return { success: false, error: 'Server not ready: ' + response };
    }

    // Send EHLO command
    await conn.write(encoder.encode(`EHLO ${config.host}\r\n`));
    const ehloBuffer = new Uint8Array(1024);
    const ehloBytesRead = await conn.read(ehloBuffer);
    const ehloResponse = decoder.decode(ehloBuffer.subarray(0, ehloBytesRead || 0));
    console.log("EHLO response:", ehloResponse);

    if (!ehloResponse.startsWith('250')) {
      conn.close();
      return { success: false, error: 'EHLO failed: ' + ehloResponse };
    }

    // Test authentication if required
    if (config.auth_required) {
      // Send AUTH LOGIN command
      await conn.write(encoder.encode('AUTH LOGIN\r\n'));
      const authBuffer = new Uint8Array(1024);
      const authBytesRead = await conn.read(authBuffer);
      const authResponse = decoder.decode(authBuffer.subarray(0, authBytesRead || 0));
      console.log("AUTH response:", authResponse);

      if (!authResponse.startsWith('334')) {
        conn.close();
        return { success: false, error: 'AUTH not supported: ' + authResponse };
      }

      // Send username (base64 encoded)
      const usernameB64 = btoa(config.username);
      await conn.write(encoder.encode(`${usernameB64}\r\n`));
      const userBuffer = new Uint8Array(1024);
      const userBytesRead = await conn.read(userBuffer);
      const userResponse = decoder.decode(userBuffer.subarray(0, userBytesRead || 0));
      console.log("Username response:", userResponse);

      // Send password (base64 encoded)
      const passwordB64 = btoa(config.password);
      await conn.write(encoder.encode(`${passwordB64}\r\n`));
      const passBuffer = new Uint8Array(1024);
      const passBytesRead = await conn.read(passBuffer);
      const passResponse = decoder.decode(passBuffer.subarray(0, passBytesRead || 0));
      console.log("Password response:", passResponse);

      if (!passResponse.startsWith('235')) {
        conn.close();
        return { success: false, error: 'Authentication failed: ' + passResponse };
      }
    }

    // Send QUIT command
    await conn.write(encoder.encode('QUIT\r\n'));
    conn.close();

    return { success: true };
  } catch (error) {
    console.error('SMTP test error:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { config } = await req.json()

    console.log('Testing SMTP config:', { 
      host: config.host, 
      port: config.port, 
      username: config.username,
      encryption: config.encryption,
      auth_required: config.auth_required
    });

    const result = await testSMTPConnection(config);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    )
  } catch (error) {
    console.error('Error testing SMTP:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
