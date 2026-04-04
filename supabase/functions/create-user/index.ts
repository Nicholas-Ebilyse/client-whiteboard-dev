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

  try {
    // 2. Initialize Supabase with the ADMIN bypass key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Get the data your React app sent
    const { email, password, role, name } = await req.json()

    // 4. Tell Supabase to create the user in the secure Auth Vault
    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirms so they can log in immediately
      user_metadata: { role: role, name: name },
      app_metadata: { role: role }
    })

    if (error) throw error

    // 5. NEW: Add the role to the public 'user_roles' table!
    // This is what the React frontend actually reads to grant admin privileges.
    if (data?.user?.id) {
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: role || 'user',
          is_suspended: false,
          suspension_reason: null
        })

      if (roleError) throw roleError
    }

    // 6. Send success back to React
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    // Send the error back if something goes wrong (e.g., email already exists)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})