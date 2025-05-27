
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

async function sendEmailViaSMTP(config: SMTPConfig, emailData: EmailData): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Sending email via SMTP ${config.host}:${config.port} to ${emailData.to}`);
    
    // Create connection to SMTP server
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Helper function to read response
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      return decoder.decode(buffer.subarray(0, bytesRead || 0));
    }

    // Helper function to send command and read response
    async function sendCommand(command: string): Promise<string> {
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    // Read initial response
    const initialResponse = await readResponse();
    console.log("Initial response:", initialResponse);
    
    if (!initialResponse.startsWith('220')) {
      conn.close();
      return { success: false, error: 'Server not ready: ' + initialResponse };
    }

    // Send EHLO command
    const ehloResponse = await sendCommand(`EHLO ${config.host}`);
    console.log("EHLO response:", ehloResponse);

    if (!ehloResponse.startsWith('250')) {
      conn.close();
      return { success: false, error: 'EHLO failed: ' + ehloResponse };
    }

    // Authenticate if required
    if (config.auth_required) {
      const authResponse = await sendCommand('AUTH LOGIN');
      console.log("AUTH response:", authResponse);

      if (!authResponse.startsWith('334')) {
        conn.close();
        return { success: false, error: 'AUTH not supported: ' + authResponse };
      }

      // Send username (base64 encoded)
      const usernameB64 = btoa(config.username);
      const userResponse = await sendCommand(usernameB64);
      console.log("Username response:", userResponse);

      // Send password (base64 encoded)
      const passwordB64 = btoa(config.password);
      const passResponse = await sendCommand(passwordB64);
      console.log("Password response:", passResponse);

      if (!passResponse.startsWith('235')) {
        conn.close();
        return { success: false, error: 'Authentication failed: ' + passResponse };
      }
    }

    // Send MAIL FROM command
    const mailFromResponse = await sendCommand(`MAIL FROM:<${emailData.from.email}>`);
    console.log("MAIL FROM response:", mailFromResponse);

    if (!mailFromResponse.startsWith('250')) {
      conn.close();
      return { success: false, error: 'MAIL FROM failed: ' + mailFromResponse };
    }

    // Send RCPT TO command
    const rcptToResponse = await sendCommand(`RCPT TO:<${emailData.to}>`);
    console.log("RCPT TO response:", rcptToResponse);

    if (!rcptToResponse.startsWith('250')) {
      conn.close();
      return { success: false, error: 'RCPT TO failed: ' + rcptToResponse };
    }

    // Send DATA command
    const dataResponse = await sendCommand('DATA');
    console.log("DATA response:", dataResponse);

    if (!dataResponse.startsWith('354')) {
      conn.close();
      return { success: false, error: 'DATA failed: ' + dataResponse };
    }

    // Construct email message
    const emailContent = [
      `From: ${emailData.from.name} <${emailData.from.email}>`,
      `To: ${emailData.to}`,
      `Subject: ${emailData.subject}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      emailData.html || emailData.text || '',
      `.`
    ].join('\r\n');

    // Send email content
    await conn.write(encoder.encode(emailContent + '\r\n'));
    const emailSentResponse = await readResponse();
    console.log("Email sent response:", emailSentResponse);

    if (!emailSentResponse.startsWith('250')) {
      conn.close();
      return { success: false, error: 'Email sending failed: ' + emailSentResponse };
    }

    // Send QUIT command
    await sendCommand('QUIT');
    conn.close();

    console.log(`✓ Email sent successfully to ${emailData.to}`);
    return { success: true };

  } catch (error) {
    console.error('SMTP sending error:', error);
    return { success: false, error: error.message };
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
      subject: emailData.subject
    });

    const result = await sendEmailViaSMTP(config, emailData);

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
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
