
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

interface EmailData {
  from: { email: string; name: string };
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function connectWithTLS(hostname: string, port: number): Promise<Deno.TcpConn> {
  console.log(`Attempting TLS connection to ${hostname}:${port}`);
  
  try {
    const conn = await Deno.connectTls({
      hostname,
      port,
    });
    console.log("✓ TLS connection established");
    return conn;
  } catch (error) {
    console.error("✗ TLS connection failed:", error.message);
    throw error;
  }
}

async function connectWithSTARTTLS(hostname: string, port: number): Promise<Deno.TlsConn> {
  console.log(`Attempting STARTTLS connection to ${hostname}:${port}`);
  
  try {
    // First establish plain connection
    const plainConn = await Deno.connect({
      hostname,
      port,
    });
    console.log("✓ Plain connection established");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Read initial greeting
    const buffer = new Uint8Array(1024);
    const bytesRead = await plainConn.read(buffer);
    const greeting = decoder.decode(buffer.subarray(0, bytesRead || 0));
    console.log("Server greeting:", greeting.trim());
    
    if (!greeting.startsWith('220')) {
      plainConn.close();
      throw new Error('Server not ready: ' + greeting);
    }

    // Send EHLO
    await plainConn.write(encoder.encode(`EHLO ${hostname}\r\n`));
    const ehloBuffer = new Uint8Array(1024);
    const ehloBytesRead = await plainConn.read(ehloBuffer);
    const ehloResponse = decoder.decode(ehloBuffer.subarray(0, ehloBytesRead || 0));
    console.log("EHLO response:", ehloResponse.trim());

    if (!ehloResponse.includes('STARTTLS')) {
      plainConn.close();
      throw new Error('Server does not support STARTTLS');
    }

    // Send STARTTLS command
    await plainConn.write(encoder.encode('STARTTLS\r\n'));
    const startTlsBuffer = new Uint8Array(1024);
    const startTlsBytesRead = await plainConn.read(startTlsBuffer);
    const startTlsResponse = decoder.decode(startTlsBuffer.subarray(0, startTlsBytesRead || 0));
    console.log("STARTTLS response:", startTlsResponse.trim());

    if (!startTlsResponse.startsWith('220')) {
      plainConn.close();
      throw new Error('STARTTLS failed: ' + startTlsResponse);
    }

    // Upgrade to TLS
    const tlsConn = await Deno.startTls(plainConn, { hostname });
    console.log("✓ STARTTLS upgrade successful");
    return tlsConn;
  } catch (error) {
    console.error("✗ STARTTLS connection failed:", error.message);
    throw error;
  }
}

async function sendEmailViaSMTP(config: SMTPConfig, emailData: EmailData): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const logs: string[] = [];
  
  try {
    logs.push(`Starting SMTP send to ${emailData.to} via ${config.host}:${config.port}`);
    logs.push(`Encryption: ${config.encryption}, Auth required: ${config.auth_required}`);
    
    let conn: Deno.TcpConn | Deno.TlsConn;
    
    // Establish connection based on encryption type
    if (config.encryption === 'ssl' || (config.encryption === 'tls' && config.port === 465)) {
      conn = await connectWithTLS(config.host, config.port);
      logs.push("Using direct TLS/SSL connection");
    } else if (config.encryption === 'tls' || config.port === 587) {
      conn = await connectWithSTARTTLS(config.host, config.port);
      logs.push("Using STARTTLS connection");
    } else {
      // Plain connection
      conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
      logs.push("Using plain connection");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Helper function to read response
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(2048);
      const bytesRead = await conn.read(buffer);
      const response = decoder.decode(buffer.subarray(0, bytesRead || 0));
      logs.push(`← ${response.trim()}`);
      return response;
    }

    // Helper function to send command and read response
    async function sendCommand(command: string): Promise<string> {
      logs.push(`→ ${command}`);
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    // If using STARTTLS, we already handled the initial greeting
    if (config.encryption !== 'tls' || config.port !== 587) {
      // Read initial response for direct connections
      const initialResponse = await readResponse();
      
      if (!initialResponse.startsWith('220')) {
        conn.close();
        logs.push("✗ Server not ready");
        return { success: false, error: 'Server not ready: ' + initialResponse, logs };
      }
    }

    // Send EHLO command (again for TLS connections)
    const ehloResponse = await sendCommand(`EHLO ${config.host}`);

    if (!ehloResponse.startsWith('250')) {
      conn.close();
      logs.push("✗ EHLO failed");
      return { success: false, error: 'EHLO failed: ' + ehloResponse, logs };
    }

    // Authenticate if required
    if (config.auth_required) {
      logs.push("Starting authentication...");
      
      // Try AUTH LOGIN first
      const authResponse = await sendCommand('AUTH LOGIN');

      if (!authResponse.startsWith('334')) {
        // Try AUTH PLAIN as fallback
        logs.push("AUTH LOGIN failed, trying AUTH PLAIN");
        const credentials = btoa(`\0${config.username}\0${config.password}`);
        const authPlainResponse = await sendCommand(`AUTH PLAIN ${credentials}`);
        
        if (!authPlainResponse.startsWith('235')) {
          conn.close();
          logs.push("✗ Authentication failed with both LOGIN and PLAIN methods");
          return { success: false, error: 'Authentication failed: ' + authPlainResponse, logs };
        }
        logs.push("✓ AUTH PLAIN successful");
      } else {
        // Continue with AUTH LOGIN
        const usernameB64 = btoa(config.username);
        const userResponse = await sendCommand(usernameB64);

        if (!userResponse.startsWith('334')) {
          conn.close();
          logs.push("✗ Username authentication failed");
          return { success: false, error: 'Username auth failed: ' + userResponse, logs };
        }

        const passwordB64 = btoa(config.password);
        const passResponse = await sendCommand(passwordB64);

        if (!passResponse.startsWith('235')) {
          conn.close();
          logs.push("✗ Password authentication failed");
          return { success: false, error: 'Password auth failed: ' + passResponse, logs };
        }
        logs.push("✓ AUTH LOGIN successful");
      }
    }

    // Send MAIL FROM command
    const mailFromResponse = await sendCommand(`MAIL FROM:<${emailData.from.email}>`);

    if (!mailFromResponse.startsWith('250')) {
      conn.close();
      logs.push("✗ MAIL FROM failed");
      return { success: false, error: 'MAIL FROM failed: ' + mailFromResponse, logs };
    }

    // Send RCPT TO command
    const rcptToResponse = await sendCommand(`RCPT TO:<${emailData.to}>`);

    if (!rcptToResponse.startsWith('250')) {
      conn.close();
      logs.push("✗ RCPT TO failed");
      return { success: false, error: 'RCPT TO failed: ' + rcptToResponse, logs };
    }

    // Send DATA command
    const dataResponse = await sendCommand('DATA');

    if (!dataResponse.startsWith('354')) {
      conn.close();
      logs.push("✗ DATA command failed");
      return { success: false, error: 'DATA failed: ' + dataResponse, logs };
    }

    // Construct email message
    const emailContent = [
      `From: ${emailData.from.name} <${emailData.from.email}>`,
      `To: ${emailData.to}`,
      `Subject: ${emailData.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      emailData.html || emailData.text || '',
      `.`
    ].join('\r\n');

    // Send email content
    logs.push("Sending email content...");
    await conn.write(encoder.encode(emailContent + '\r\n'));
    const emailSentResponse = await readResponse();

    if (!emailSentResponse.startsWith('250')) {
      conn.close();
      logs.push("✗ Email sending failed");
      return { success: false, error: 'Email sending failed: ' + emailSentResponse, logs };
    }

    // Send QUIT command
    await sendCommand('QUIT');
    conn.close();

    logs.push(`✓ Email sent successfully to ${emailData.to}`);
    return { success: true, logs };

  } catch (error) {
    logs.push(`✗ SMTP error: ${error.message}`);
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message, logs };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { config, emailData } = await req.json()

    console.log('Sending email via SMTP:', {
      host: config.host,
      port: config.port,
      to: emailData.to,
      subject: emailData.subject,
      encryption: config.encryption
    });

    const result = await sendEmailViaSMTP(config, emailData);

    // Log all the SMTP transaction logs
    console.log('SMTP Transaction Logs:');
    result.logs.forEach(log => console.log(log));

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message, logs: [`Fatal error: ${error.message}`] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
