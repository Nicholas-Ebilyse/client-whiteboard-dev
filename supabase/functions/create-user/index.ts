import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS preflight requests from the browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const responseHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuration serveur manquante' }), {
        status: 500,
        headers: responseHeaders,
      });
    }

    // 2. Initialize Supabase with the ADMIN bypass key
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    // 4. Verify caller has admin role and is not suspended
    const { data: callerRole } = await supabaseClient
      .from('user_roles')
      .select('role, is_suspended')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!callerRole || callerRole.is_suspended) {
      return new Response(JSON.stringify({ error: 'Accès administrateur requis pour créer un utilisateur' }), {
        status: 403,
        headers: responseHeaders,
      });
    }

    // 5. Get the data your React app sent
    const { email, password, role, name } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email et mot de passe requis' }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    // 6. Tell Supabase to create the user in the secure Auth Vault
    const targetRole = role === 'admin' ? 'admin' : 'user';
    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirms so they can log in immediately
      user_metadata: { role: targetRole, name: name },
      app_metadata: { role: targetRole }
    });

    if (error) throw error;

    // 7. Add the role to the public 'user_roles' table
    if (data?.user?.id) {
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: targetRole,
          is_suspended: false,
          suspension_reason: null
        });

      if (roleError) throw roleError;
    }

    // 8. Send success back to React
    return new Response(JSON.stringify(data), {
      headers: responseHeaders,
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: responseHeaders,
      status: 400,
    });
  }
})
