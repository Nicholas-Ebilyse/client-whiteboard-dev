import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const scheduleEmailSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }).max(255, { message: "Email must be less than 255 characters" }),
  note: z.string().max(1000, { message: "Note must be less than 1000 characters" }).optional(),
  weekNumber: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  pdfData: z.string(),
});

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-schedule-email] Request received:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authorization check - only authenticated users can send schedules
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    console.log("[send-schedule-email] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.log("[send-schedule-email] No auth header - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized - no auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    console.log("[send-schedule-email] User check:", { hasUser: !!user, error: userError?.message });

    if (userError || !user) {
      console.log("[send-schedule-email] User auth failed - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin using service role
    console.log("[send-schedule-email] Checking admin status for user:", user.id);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    console.log("[send-schedule-email] Admin check:", { adminCheck, error: adminError?.message });

    if (!adminCheck) {
      console.log("[send-schedule-email] User is not admin - returning 403");
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const validation = scheduleEmailSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, note, weekNumber, year, pdfData } = validation.data;
    
    console.log("[send-schedule-email] Preparing email to:", email, "week:", weekNumber, "year:", year);
    console.log("[send-schedule-email] PDF data length:", pdfData?.length || 0);

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(RESEND_API_KEY);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Planning hebdomadaire - Semaine ${weekNumber} (${year})</h2>
        ${note ? `<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #666;"><strong>Note:</strong></p>
          <p style="margin: 10px 0 0 0; color: #333;">${note}</p>
        </div>` : ''}
        <p style="color: #666;">Veuillez trouver ci-joint le planning de la semaine ${weekNumber} au format PDF.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Cet email a été envoyé automatiquement depuis votre système de planning.</p>
      </div>
    `;
    
    console.log("[send-schedule-email] Sending email via Resend SDK...");

    const emailResponse = await resend.emails.send({
      from: "Planning Ebilyse <onboarding@resend.dev>",
      to: [email],
      subject: `Planning hebdomadaire - Semaine ${weekNumber} (${year})`,
      html: emailHtml,
      attachments: [
        {
          filename: `planning-semaine-${weekNumber}-${year}.pdf`,
          content: pdfData,
        },
      ],
    });

    if (emailResponse.error) {
      console.error("[send-schedule-email] Resend API error:", JSON.stringify(emailResponse.error));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message || "Email sending failed" 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[send-schedule-email] Email sent successfully:", emailResponse.data);

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
