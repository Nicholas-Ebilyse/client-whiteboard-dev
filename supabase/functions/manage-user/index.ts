import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate caller
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

    // 2. Verify caller has admin role and is not suspended
    const { data: callerRole } = await supabaseClient
      .from('user_roles')
      .select('role, is_suspended')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!callerRole || callerRole.is_suspended) {
      return new Response(JSON.stringify({ error: 'Accès administrateur requis pour gérer les utilisateurs' }), {
        status: 403,
        headers: responseHeaders,
      });
    }

    const { userId, action, reason } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Identifiant utilisateur requis' }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    // Prevent self-lockout
    if (caller.id === userId && (action === 'revoke' || action === 'suspend')) {
      return new Response(JSON.stringify({ error: 'Vous ne pouvez pas révoquer ou suspendre votre propre compte administrateur' }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    let roleTableUpdate: any = {}
    let authVaultUpdate = {}

    switch (action) {
      case 'grant':
        roleTableUpdate = { role: 'admin' }
        authVaultUpdate = { app_metadata: { role: 'admin' }, user_metadata: { role: 'admin' } }
        break;
      case 'revoke':
        roleTableUpdate = { role: 'user' }
        authVaultUpdate = { app_metadata: { role: 'user' }, user_metadata: { role: 'user' } }
        break;
      case 'suspend':
        roleTableUpdate = { is_suspended: true, suspension_reason: reason || 'Suspendu par un administrateur' }
        authVaultUpdate = { ban_duration: '87600h' }
        break;
      case 'unsuspend':
        roleTableUpdate = { is_suspended: false, suspension_reason: null }
        authVaultUpdate = { ban_duration: 'none' }
        break;
      default:
        throw new Error('Action non reconnue')
    }

    // 3. Check if the user already has a row in the public user_roles table
    const { data: existingRole } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    let dbError;

    if (existingRole) {
      // 4A. Update existing row
      const { error } = await supabaseClient
        .from('user_roles')
        .update(roleTableUpdate)
        .eq('user_id', userId)
      dbError = error;
    } else {
      // 4B. Insert a new row
      const { error } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: roleTableUpdate.role || 'user',
          is_suspended: roleTableUpdate.is_suspended || false,
          suspension_reason: roleTableUpdate.suspension_reason || null
        })
      dbError = error;
    }

    if (dbError) throw dbError

    // 5. Update the Auth Vault
    const { error: authError } = await supabaseClient.auth.admin.updateUserById(userId, authVaultUpdate)
    if (authError) throw authError

    return new Response(JSON.stringify({ success: true }), {
      headers: responseHeaders,
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: responseHeaders,
      status: 400,
    })
  }
})
