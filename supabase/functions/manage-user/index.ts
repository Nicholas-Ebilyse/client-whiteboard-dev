import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, action, reason } = await req.json()

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
        roleTableUpdate = { is_suspended: true, suspension_reason: reason }
        authVaultUpdate = { ban_duration: '87600h' }
        break;
      case 'unsuspend':
        roleTableUpdate = { is_suspended: false, suspension_reason: null }
        authVaultUpdate = { ban_duration: 'none' }
        break;
      default:
        throw new Error('Action non reconnue')
    }

    // 1. Check if the user already has a row in the public user_roles table
    const { data: existingRole } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    let dbError;

    if (existingRole) {
      // 2A. The row exists, so we UPDATE it normally
      const { error } = await supabaseClient
        .from('user_roles')
        .update(roleTableUpdate)
        .eq('user_id', userId)
      dbError = error;
    } else {
      // 2B. The row DOES NOT exist, so we INSERT a brand new row!
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

    // 3. Update the hidden Auth Vault (For strict backend security)
    const { error: authError } = await supabaseClient.auth.admin.updateUserById(userId, authVaultUpdate)

    if (authError) throw authError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})