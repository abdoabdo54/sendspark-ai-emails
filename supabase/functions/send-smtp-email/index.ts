
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

async function sendEmailViaSMTP(config: SMTPConfig, emailData: EmailData): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const logs: string[] = [];
  
  try {
    logs.push(`🚀 Starting SMTP send to ${emailData.to} via ${config.host}:${config.port}`);
    
    // Determine connection type based on common SMTP configurations
    let useDirectTLS = false;
    let useSTARTTLS = false;
    
    // Gmail and common providers
    if (config.host.includes('gmail') || config.port === 465 || config.encryption === 'ssl') {
      useDirectTLS = true;
      logs.push("📧 Using direct TLS/SSL connection for Gmail/secure SMTP");
    } else if (config.port === 587 || config.encryption === 'tls') {
      useSTARTTLS = true;
      logs.push("📧 Using STARTTLS connection");
    } else {
      logs.push("📧 Using plain connection");
    }

    let conn: Deno.TcpConn | Deno.TlsConn;
    
    // Establish connection
    if (useDirectTLS) {
      try {
        conn = await Deno.connectTls({
          hostname: config.host,
          port: config.port,
        });
        logs.push("✅ Direct TLS connection established");
      } catch (error) {
        logs.push(`❌ Direct TLS failed: ${error.message}`);
        throw error;
      }
    } else if (useSTARTTLS) {
      try {
        // Start with plain connection
        const plainConn = await Deno.connect({
          hostname: config.host,
          port: config.port,
        });
        logs.push("✅ Plain connection established for STARTTLS");

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        // Read greeting
        const buffer = new Uint8Array(1024);
        const bytesRead = await plainConn.read(buffer);
        const greeting = decoder.decode(buffer.subarray(0, bytesRead || 0));
        logs.push(`📨 Server greeting: ${greeting.trim()}`);
        
        if (!greeting.startsWith('220')) {
          plainConn.close();
          throw new Error('Server not ready: ' + greeting);
        }

        // Send EHLO
        await plainConn.write(encoder.encode(`EHLO ${config.host}\r\n`));
        const ehloBuffer = new Uint8Array(1024);
        const ehloBytesRead = await plainConn.read(ehloBuffer);
        const ehloResponse = decoder.decode(ehloBuffer.subarray(0, ehloBytesRead || 0));
        logs.push(`📨 EHLO response: ${ehloResponse.trim()}`);

        if (!ehloResponse.includes('STARTTLS')) {
          plainConn.close();
          throw new Error('Server does not support STARTTLS');
        }

        // Send STARTTLS
        await plainConn.write(encoder.encode('STARTTLS\r\n'));
        const startTlsBuffer = new Uint8Array(1024);
        const startTlsBytesRead = await plainConn.read(startTlsBuffer);
        const startTlsResponse = decoder.decode(startTlsBuffer.subarray(0, startTlsBytesRead || 0));
        logs.push(`📨 STARTTLS response: ${startTlsResponse.trim()}`);

        if (!startTlsResponse.startsWith('220')) {
          plainConn.close();
          throw new Error('STARTTLS failed: ' + startTlsResponse);
        }

        // Upgrade to TLS
        conn = await Deno.startTls(plainConn, { hostname: config.host });
        logs.push("✅ STARTTLS upgrade successful");
      } catch (error) {
        logs.push(`❌ STARTTLS failed: ${error.message}`);
        throw error;
      }
    } else {
      // Plain connection
      conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
      logs.push("✅ Plain connection established");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Helper functions
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(2048);
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

    // For TLS connections that haven't read greeting yet
    if (useDirectTLS) {
      const initialResponse = await readResponse();
      if (!initialResponse.startsWith('220')) {
        conn.close();
        throw new Error('Server not ready: ' + initialResponse);
      }
    }

    // Send EHLO (again for TLS connections)
    const ehloResponse = await sendCommand(`EHLO ${config.host}`);
    if (!ehloResponse.startsWith('250')) {
      conn.close();
      throw new Error('EHLO failed: ' + ehloResponse);
    }

    // Authentication
    if (config.auth_required) {
      logs.push("🔐 Starting authentication...");
      
      // Try AUTH LOGIN first (most common)
      const authResponse = await sendCommand('AUTH LOGIN');

      if (authResponse.startsWith('334')) {
        // AUTH LOGIN flow
        const usernameB64 = btoa(config.username);
        const userResponse = await sendCommand(usernameB64);

        if (!userResponse.startsWith('334')) {
          conn.close();
          throw new Error('Username authentication failed: ' + userResponse);
        }

        const passwordB64 = btoa(config.password);
        const passResponse = await sendCommand(passwordB64);

        if (!passResponse.startsWith('235')) {
          conn.close();
          throw new Error('Password authentication failed: ' + passResponse);
        }
        logs.push("✅ AUTH LOGIN successful");
      } else {
        // Try AUTH PLAIN
        logs.push("🔄 AUTH LOGIN failed, trying AUTH PLAIN");
        const credentials = btoa(`\0${config.username}\0${config.password}`);
        const authPlainResponse = await sendCommand(`AUTH PLAIN ${credentials}`);
        
        if (!authPlainResponse.startsWith('235')) {
          conn.close();
          throw new Error('Authentication failed with both LOGIN and PLAIN: ' + authPlainResponse);
        }
        logs.push("✅ AUTH PLAIN successful");
      }
    }

    // Send email
    const mailFromResponse = await sendCommand(`MAIL FROM:<${emailData.from.email}>`);
    if (!mailFromResponse.startsWith('250')) {
      conn.close();
      throw new Error('MAIL FROM failed: ' + mailFromResponse);
    }

    const rcptToResponse = await sendCommand(`RCPT TO:<${emailData.to}>`);
    if (!rcptToResponse.startsWith('250')) {
      conn.close();
      throw new Error('RCPT TO failed: ' + rcptToResponse);
    }

    const dataResponse = await sendCommand('DATA');
    if (!dataResponse.startsWith('354')) {
      conn.close();
      throw new Error('DATA command failed: ' + dataResponse);
    }

    // Construct email
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

    await conn.write(encoder.encode(emailContent + '\r\n'));
    const emailSentResponse = await readResponse();

    if (!emailSentResponse.startsWith('250')) {
      conn.close();
      throw new Error('Email sending failed: ' + emailSentResponse);
    }

    await sendCommand('QUIT');
    conn.close();

    logs.push(`✅ Email sent successfully to ${emailData.to}`);
    return { success: true, logs };

  } catch (error) {
    logs.push(`❌ SMTP error: ${error.message}`);
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

    console.log('📧 SMTP Send Request:', {
      host: config.host,
      port: config.port,
      to: emailData.to,
      subject: emailData.subject,
      encryption: config.encryption,
      auth_required: config.auth_required
    });

    const result = await sendEmailViaSMTP(config, emailData);

    // Log all transaction logs
    console.log('📋 SMTP Transaction Logs:');
    result.logs.forEach(log => console.log(log));

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    )
  } catch (error) {
    console.error('❌ Fatal SMTP error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message, 
        logs: [`❌ Fatal error: ${error.message}`] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
