import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorNotificationRequest {
  errorMessage: string;
  errorDetails?: any;
  syncType: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal shared secret to prevent unauthenticated access
    const internalKey = req.headers.get('x-internal-key');
    const expectedKey = Deno.env.get('WEBHOOK_API_KEY');
    if (!internalKey || !expectedKey || internalKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const { errorMessage, errorDetails, syncType, timestamp }: ErrorNotificationRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Planning App <onboarding@resend.dev>",
      to: ["nicholas@ebilyse.com"],
      subject: `🚨 Sync Error: ${syncType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Synchronization Error</h1>
          <p><strong>Sync Type:</strong> ${syncType}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>Error Message:</strong></p>
          <div style="background-color: #fee; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0;">
            ${errorMessage}
          </div>
          ${errorDetails ? `
            <p><strong>Additional Details:</strong></p>
            <pre style="background-color: #f5f5f5; padding: 15px; overflow-x: auto; border-radius: 4px;">
${JSON.stringify(errorDetails, null, 2)}
            </pre>
          ` : ''}
          <p style="margin-top: 30px; color: #666;">
            Please check the application logs and sync status for more information.
          </p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});