
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      campaignId, 
      selectedAccounts, 
      rotation = {}, 
      rateLimit = {},
      googleCloudConfig = null
    } = await req.json()

    console.log(`Preparing campaign ${campaignId} with ${selectedAccounts?.length || 0} accounts`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      throw new Error('Campaign not found')
    }

    // Get selected accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .in('id', selectedAccounts || [])
      .eq('is_active', true)

    if (accountsError) throw accountsError
    if (!accounts || accounts.length === 0) {
      throw new Error('No active accounts found')
    }

    console.log(`Using ${accounts.length} accounts`);

    // Parse recipients
    const recipients = campaign.recipients
      .split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email.length > 0)

    if (recipients.length === 0) {
      throw new Error('No valid recipients found')
    }

    // Calculate total sending capacity
    const totalCapacity = accounts.reduce((total, account) => {
      const accountRateLimit = rateLimit[account.id] || 3600; // Default 1 email per second
      return total + (accountRateLimit / 3600); // Convert to emails per second
    }, 0);

    console.log(`Total sending capacity: ${totalCapacity} emails/second`);

    // Prepare FROM name and subject variations for rotation
    const fromNames = rotation.useFromNameRotation && rotation.fromNames?.length > 0 
      ? rotation.fromNames 
      : [campaign.from_name];
    
    const subjects = rotation.useSubjectRotation && rotation.subjects?.length > 0 
      ? rotation.subjects 
      : [campaign.subject];

    // Prepare emails with account distribution and rotation
    const preparedEmails = [];
    let accountIndex = 0;
    let fromNameIndex = 0;
    let subjectIndex = 0;

    for (let i = 0; i < recipients.length; i++) {
      const account = accounts[accountIndex];
      const fromName = fromNames[fromNameIndex];
      const subject = subjects[subjectIndex];

      preparedEmails.push({
        recipient: recipients[i],
        subject: subject,
        fromEmail: account.email,
        fromName: fromName,
        htmlContent: campaign.html_content,
        textContent: campaign.text_content,
        account_id: account.id,
        accountType: account.type,
        accountConfig: account.config,
        status: 'pending',
        preparedAt: new Date().toISOString()
      });

      // Round-robin through accounts
      accountIndex = (accountIndex + 1) % accounts.length;
      
      // Round-robin through FROM names if rotation is enabled
      if (rotation.useFromNameRotation) {
        fromNameIndex = (fromNameIndex + 1) % fromNames.length;
      }
      
      // Round-robin through subjects if rotation is enabled
      if (rotation.useSubjectRotation) {
        subjectIndex = (subjectIndex + 1) % subjects.length;
      }
    }

    // Update campaign with prepared emails and configuration
    const campaignConfig = {
      selectedAccounts,
      rotation,
      rateLimit,
      totalCapacity,
      preparedAt: new Date().toISOString(),
      // Include Google Cloud Functions config if provided
      ...(googleCloudConfig?.enabled && { googleCloudFunctions: googleCloudConfig })
    };

    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'prepared',
        total_recipients: recipients.length,
        prepared_emails: preparedEmails,
        config: campaignConfig
      })
      .eq('id', campaignId)

    if (updateError) throw updateError

    console.log(`Campaign ${campaignId} prepared successfully with ${preparedEmails.length} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campaign prepared successfully',
        totalEmails: preparedEmails.length,
        accountsUsed: accounts.length,
        fromNameVariations: fromNames.length,
        subjectVariations: subjects.length,
        totalCapacity: `${totalCapacity.toFixed(2)} emails/second`,
        config: campaignConfig
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error preparing campaign:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
