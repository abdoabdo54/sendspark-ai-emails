
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

async function connectWithTLS(hostname: string, port: number): Promise<Deno.TcpConn> {
  console.log(`Testing TLS connection to ${hostname}:${port}`);
  
  try {
    const conn = await Deno.connectTls({
      hostname,
      port,
    });
    console.log("✓ TLS connection test successful");
    return conn;
  } catch (error) {
    console.error("✗ TLS connection test failed:", error.message);
    throw error;
  }
}

async function connectWithSTARTTLS(hostname: string, port: number): Promise<Deno.TlsConn> {
  console.log(`Testing STARTTLS connection to ${hostname}:${port}`);
  
  try {
    const plainConn = await Deno.connect({
      hostname,
      port,
    });
    console.log("✓ Plain connection established for STARTTLS test");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const buffer = new Uint8Array(1024);
    const bytesRead = await plainConn.read(buffer);
    const greeting = decoder.decode(buffer.subarray(0, bytesRead || 0));
    console.log("Server greeting:", greeting.trim());
    
    if (!greeting.startsWith('220')) {
      plainConn.close();
      throw new Error('Server not ready: ' + greeting);
    }

    await plainConn.write(encoder.encode(`EHLO ${hostname}\r\n`));
    const ehloBuffer = new Uint8Array(1024);
    const ehloBytesRead = await plainConn.read(ehloBuffer);
    const ehloResponse = decoder.decode(ehloBuffer.subarray(0, ehloBytesRead || 0));
    console.log("EHLO response:", ehloResponse.trim());

    if (!ehloResponse.includes('STARTTLS')) {
      plainConn.close();
      throw new Error('Server does not support STARTTLS');
    }

    await plainConn.write(encoder.encode('STARTTLS\r\n'));
    const startTlsBuffer = new Uint8Array(1024);
    const startTlsBytesRead = await plainConn.read(startTlsBuffer);
    const startTlsResponse = decoder.decode(startTlsBuffer.subarray(0, startTlsBytesRead || 0));
    console.log("STARTTLS response:", startTlsResponse.trim());

    if (!startTlsResponse.startsWith('220')) {
      plainConn.close();
      throw new Error('STARTTLS failed: ' + startTlsResponse);
    }

    const tlsConn = await Deno.startTls(plainConn, { hostname });
    console.log("✓ STARTTLS test successful");
    return tlsConn;
  } catch (error) {
    console.error("✗ STARTTLS test failed:", error.message);
    throw error;
  }
}

async function testSMTPConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const logs: string[] = [];
  
  try {
    logs.push(`Testing SMTP connection to ${config.host}:${config.port}`);
    logs.push(`Encryption: ${config.encryption}, Auth required: ${config.auth_required}`);
    
    let conn: Deno.TcpConn | Deno.TlsConn;
    
    // Test connection based on encryption type
    if (config.encryption === 'ssl' || (config.encryption === 'tls' && config.port === 465)) {
      conn = await connectWithTLS(config.host, config.port);
      logs.push("Direct TLS/SSL connection successful");
    } else if (config.encryption === 'tls' || config.port === 587) {
      conn = await connectWithSTARTTLS(config.host, config.port);
      logs.push("STARTTLS connection successful");
    } else {
      conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
      logs.push("Plain connection successful");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      const response = decoder.decode(buffer.subarray(0, bytesRead || 0));
      logs.push(`← ${response.trim()}`);
      return response;
    }

    async function sendCommand(command: string): Promise<string> {
      logs.push(`→ ${command}`);
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    // If not STARTTLS, read initial greeting
    if (config.encryption !== 'tls' || config.port !== 587) {
      const initialResponse = await readResponse();
      
      if (!initialResponse.startsWith('220')) {
        conn.close();
        logs.push("✗ Server not ready");
        return { success: false, error: 'Server not ready: ' + initialResponse, logs };
      }
    }

    // Send EHLO
    const ehloResponse = await sendCommand(`EHLO ${config.host}`);

    if (!ehloResponse.startsWith('250')) {
      conn.close();
      logs.push("✗ EHLO failed");
      return { success: false, error: 'EHLO failed: ' + ehloResponse, logs };
    }

    // Test authentication if required
    if (config.auth_required) {
      logs.push("Testing authentication...");
      
      const authResponse = await sendCommand('AUTH LOGIN');

      if (!authResponse.startsWith('334')) {
        // Try AUTH PLAIN
        logs.push("AUTH LOGIN not supported, testing AUTH PLAIN");
        const credentials = btoa(`\0${config.username}\0${config.password}`);
        const authPlainResponse = await sendCommand(`AUTH PLAIN ${credentials}`);
        
        if (!authPlainResponse.startsWith('235')) {
          conn.close();
          logs.push("✗ Authentication test failed");
          return { success: false, error: 'Authentication failed: ' + authPlainResponse, logs };
        }
        logs.push("✓ AUTH PLAIN test successful");
      } else {
        const usernameB64 = btoa(config.username);
        const userResponse = await sendCommand(usernameB64);

        if (!userResponse.startsWith('334')) {
          conn.close();
          logs.push("✗ Username authentication test failed");
          return { success: false, error: 'Username auth failed: ' + userResponse, logs };
        }

        const passwordB64 = btoa(config.password);
        const passResponse = await sendCommand(passwordB64);

        if (!passResponse.startsWith('235')) {
          conn.close();
          logs.push("✗ Password authentication test failed");
          return { success: false, error: 'Password auth failed: ' + passResponse, logs };
        }
        logs.push("✓ AUTH LOGIN test successful");
      }
    }

    await sendCommand('QUIT');
    conn.close();

    logs.push("✓ SMTP connection test completed successfully");
    return { success: true, logs };
  } catch (error) {
    logs.push(`✗ SMTP test error: ${error.message}`);
    console.error('SMTP test error:', error);
    return { success: false, error: error.message, logs };
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

    // Log all test results
    console.log('SMTP Test Logs:');
    result.logs.forEach(log => console.log(log));

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
      JSON.stringify({ success: false, error: error.message, logs: [`Fatal error: ${error.message}`] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
