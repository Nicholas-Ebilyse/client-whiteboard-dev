import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("[list-users] Unauthorized:", userError);
      return new Response(
        JSON.stringify({ error: "Session invalide", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin using service role client
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    console.log("[list-users] Role check:", { isAdmin: !!roleData, error: roleError?.message });

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Admin access required",
          details: roleError?.message,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // List all users using admin client
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all admin roles and suspension status
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, is_suspended, suspension_reason")
      .eq("role", "admin");

    const adminIds = new Set(adminRoles?.map((r) => r.user_id) || []);

    // Get all user roles including suspensions
    const { data: allRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, is_suspended, suspension_reason");

    const allSuspensionMap = new Map(
      allRoles?.map((r) => [r.user_id, { is_suspended: r.is_suspended, suspension_reason: r.suspension_reason }]) || []
    );

    // Format the response
    const usersWithRoles = (users || []).map((u) => {
      const suspensionInfo =
        allSuspensionMap.get(u.id) || ({ is_suspended: false, suspension_reason: null } as {
          is_suspended: boolean;
          suspension_reason: string | null;
        });
      return {
        id: u.id,
        email: u.email || "N/A",
        created_at: u.created_at,
        is_admin: adminIds.has(u.id),
        is_suspended: suspensionInfo.is_suspended,
        suspension_reason: suspensionInfo.suspension_reason,
      };
    });

    console.log("[list-users] Returning", usersWithRoles.length, "users");

    return new Response(JSON.stringify({ users: usersWithRoles }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[list-users] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error in list-users" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
