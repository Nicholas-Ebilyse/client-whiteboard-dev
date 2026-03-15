import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-api-key, x-api-key',
};

interface GoogleSheetsCredentials {
  client_email: string;
  private_key: string;
}

async function getAccessToken(credentials: GoogleSheetsCredentials): Promise<string> {
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedClaim = btoa(JSON.stringify(jwtClaim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentials.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchSheetData(spreadsheetId: string, sheetName: string, accessToken: string): Promise<any[][]> {
  const range = `${sheetName}!A:Z`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet data: ${await response.text()}`);
  }

  const data = await response.json();
  return data.values || [];
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

async function sendErrorNotification(errorMessage: string, errorDetails: any, syncType: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return;
    }
    
    const webhookApiKey = Deno.env.get('WEBHOOK_API_KEY');
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sync-error-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'x-internal-key': webhookApiKey || ''
      },
      body: JSON.stringify({
        errorMessage,
        errorDetails,
        syncType,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    // Silently fail - don't let notification errors break the main flow
  }
}

// Authenticate request - supports both API key (for AppSheet/cron) and JWT (for UI)
async function authenticateRequest(req: Request, supabase: any): Promise<{ success: boolean; error?: string; authType?: string; userId?: string }> {
  // Check for API key authentication (from AppSheet webhooks or cron jobs)
  // Support both x-webhook-api-key and x-api-key headers
  const webhookApiKey = req.headers.get('x-webhook-api-key') || req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('WEBHOOK_API_KEY');
  
  if (webhookApiKey && expectedApiKey && webhookApiKey === expectedApiKey) {
    console.log('Authenticated via API key (webhook/cron)');
    return { success: true, authType: 'api_key' };
  }
  
  // Check for JWT authentication (from UI)
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (!userError && user) {
      // Verify admin role for JWT auth
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (adminCheck) {
        console.log(`Authenticated via JWT (admin user: ${user.id})`);
        return { success: true, authType: 'jwt', userId: user.id };
      }
    }
  }
  
  return { success: false, error: 'Authentication required. Use API key or admin JWT.' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Create sync status record
  const { data: syncRecord } = await supabase
    .from('sync_status')
    .insert({
      sync_type: 'google_sheets_webhook',
      status: 'running'
    })
    .select()
    .single();

  try {
    // Authenticate request (API key or JWT)
    const authResult = await authenticateRequest(req, supabase);
    
    if (!authResult.success) {
      await supabase.from('sync_status').update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: authResult.error
      }).eq('id', syncRecord?.id);
      
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check for recent sync operations (1 minute minimum interval)
    const { data: lastSync } = await supabase
      .from('sync_status')
      .select('started_at')
      .eq('sync_type', 'google_sheets_webhook')
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSync) {
      const timeSinceLastSync = Date.now() - new Date(lastSync.started_at).getTime();
      const minInterval = 60000; // 1 minute
      
      if (timeSinceLastSync < minInterval) {
        const remainingSeconds = Math.ceil((minInterval - timeSinceLastSync) / 1000);
        const errorMsg = `Rate limit exceeded. Please wait ${remainingSeconds} seconds before syncing again.`;
        await supabase.from('sync_status').update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: errorMsg
        }).eq('id', syncRecord?.id);
        
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Sync initiated via ${authResult.authType}${authResult.userId ? ` by user: ${authResult.userId}` : ''}`);

    const googleCredsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!googleCredsJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }

    const googleCreds: GoogleSheetsCredentials = JSON.parse(googleCredsJson);
    const accessToken = await getAccessToken(googleCreds);

    // Get the spreadsheet ID from the request body or use hardcoded default
    const body = await req.json().catch(() => ({}));
    const spreadsheetId = body.spreadsheetId || '1hTdAy4pmhJQC6L7SJtRz_S2eQF_Lff4_7coUwouvDGI';
    
    // Sync Commandes
    const commandesData = await fetchSheetData(spreadsheetId, 'Commandes', accessToken);
    let commandesCount = 0;
    const commandesErrors: any[] = [];

    if (commandesData.length > 0) {
      const headers = commandesData[0];
      const idIndex = headers.findIndex(h => h?.toLowerCase().includes('id'));
      const numeroIndex = headers.findIndex(h => h?.toLowerCase().includes('numéro') || h?.toLowerCase().includes('numero'));
      const clientIndex = headers.findIndex(h => h?.toLowerCase().includes('client'));
      const chantierIndex = headers.findIndex(h => h?.toLowerCase().includes('chantier') || h?.toLowerCase().includes('adresse'));
      const montantHtIndex = headers.findIndex(h => h?.toLowerCase().includes('montant'));
      const achatsIndex = headers.findIndex(h => h?.toLowerCase().includes('achat'));
      const dateIndex = headers.findIndex(h => h?.toLowerCase().includes('date'));
      const factureIndex = headers.findIndex(h => h?.toLowerCase().includes('facture') && !h?.toLowerCase().includes('facturée'));
      const isInvoicedIndex = headers.findIndex(h => h?.toLowerCase().includes('facturée') || h?.toLowerCase() === 'facturee');

      if (clientIndex !== -1 && chantierIndex !== -1) {
        for (let i = 1; i < commandesData.length; i++) {
          const row = commandesData[i];
          if (!row || row.length === 0) continue;

          const externalId = idIndex >= 0 ? row[idIndex]?.toString().trim() : null;
          const numero = numeroIndex >= 0 ? row[numeroIndex]?.toString().trim() || null : null;
          const client = clientIndex >= 0 ? row[clientIndex]?.toString().trim() : null;
          const chantier = chantierIndex >= 0 ? row[chantierIndex]?.toString().trim() : null;
          const montantHt = montantHtIndex >= 0 ? parseFloat(row[montantHtIndex]) : null;
          const achats = achatsIndex >= 0 ? parseFloat(row[achatsIndex]) : null;
          const dateStr = dateIndex >= 0 ? row[dateIndex]?.toString().trim() : null;
          const date = parseDate(dateStr || '');
          const facture = factureIndex >= 0 ? row[factureIndex]?.toString().trim() || null : null;
          const isInvoicedRaw = isInvoicedIndex >= 0 ? row[isInvoicedIndex]?.toString().trim().toLowerCase() : null;
          const isInvoiced = isInvoicedRaw === 'true' || isInvoicedRaw === 'vrai' || isInvoicedRaw === '1';

          if (!client || !chantier) {
            commandesErrors.push({ row: i + 1, reason: 'Missing client or chantier', data: { client, chantier } });
            continue;
          }

          const commande = {
            external_id: externalId,
            numero: numero,
            client: client,
            chantier: chantier,
            montant_ht: montantHt,
            achats: achats,
            date: date,
            facture: facture || null,
            is_invoiced: isInvoiced
          };

          const { error } = await supabase
            .from('commandes')
            .upsert(commande, { 
              onConflict: 'external_id',
              ignoreDuplicates: false 
            });
          
          if (error) {
            commandesErrors.push({ row: i + 1, reason: error.message, data: commande });
          } else {
            commandesCount++;
          }
        }
      }
    }
    
    // Sync SAV
    let savCount = 0;
    const savErrors: any[] = [];
    
    try {
      const savData = await fetchSheetData(spreadsheetId, 'SAV', accessToken);
      
      if (savData.length > 0) {
        const headers = savData[0];
        console.log('SAV sheet headers:', headers.join(', '));
        
        const idIndex = headers.findIndex(h => h?.toLowerCase().includes('id'));
        const numeroIndex = headers.findIndex(h => h?.toLowerCase().includes('numéro') || h?.toLowerCase().includes('numero') || h?.toLowerCase() === 'n°');
        const nomClientIndex = headers.findIndex(h => h?.toLowerCase().includes('nom') || h?.toLowerCase().includes('client'));
        const adresseIndex = headers.findIndex(h => h?.toLowerCase().includes('adresse'));
        const telephoneIndex = headers.findIndex(h => h?.toLowerCase().includes('téléphone') || h?.toLowerCase().includes('telephone') || h?.toLowerCase().includes('tel'));
        const problemeIndex = headers.findIndex(h => h?.toLowerCase().includes('problème') || h?.toLowerCase().includes('probleme') || h?.toLowerCase().includes('description'));
        const dateIndex = headers.findIndex(h => h?.toLowerCase().includes('date'));
        const estResoluIndex = headers.findIndex(h => h?.toLowerCase().includes('résolu') || h?.toLowerCase().includes('resolu'));

        console.log(`SAV column indices - ID: ${idIndex}, Numero: ${numeroIndex}, NomClient: ${nomClientIndex}, Adresse: ${adresseIndex}, Telephone: ${telephoneIndex}, Probleme: ${problemeIndex}, Date: ${dateIndex}, EstResolu: ${estResoluIndex}`);

        for (let i = 1; i < savData.length; i++) {
          const row = savData[i];
          if (!row || row.length === 0) continue;

          const externalId = idIndex >= 0 ? row[idIndex]?.toString().trim() : null;
          const numeroStr = numeroIndex >= 0 ? row[numeroIndex]?.toString().trim() : null;
          const numero = numeroStr ? parseInt(numeroStr) : null;
          const nomClient = nomClientIndex >= 0 ? row[nomClientIndex]?.toString().trim() : null;
          const adresse = adresseIndex >= 0 ? row[adresseIndex]?.toString().trim() : null;
          const telephone = telephoneIndex >= 0 ? row[telephoneIndex]?.toString().trim() || null : null;
          const probleme = problemeIndex >= 0 ? row[problemeIndex]?.toString().trim() : null;
          const dateStr = dateIndex >= 0 ? row[dateIndex]?.toString().trim() : null;
          const date = parseDate(dateStr || '');
          const estResoluRaw = estResoluIndex >= 0 ? row[estResoluIndex]?.toString().trim().toLowerCase() : null;
          const estResolu = estResoluRaw === 'true' || estResoluRaw === 'vrai' || estResoluRaw === '1' || estResoluRaw === 'oui';

          if (!nomClient || !adresse || !probleme || numero === null || isNaN(numero)) {
            savErrors.push({ row: i + 1, reason: 'Missing required fields', data: { numero, nomClient, adresse, probleme } });
            continue;
          }

          const savRecord = {
            external_id: externalId,
            numero: numero,
            nom_client: nomClient,
            adresse: adresse,
            telephone: telephone,
            probleme: probleme,
            date: date || new Date().toISOString().split('T')[0],
            est_resolu: estResolu
          };

          const { error } = await supabase
            .from('sav')
            .upsert(savRecord, { 
              onConflict: 'external_id',
              ignoreDuplicates: false 
            });
          
          if (error) {
            savErrors.push({ row: i + 1, reason: error.message, data: savRecord });
          } else {
            savCount++;
          }
        }
      }
    } catch (savError: any) {
      console.error('Error syncing SAV:', savError.message);
      savErrors.push({ error: savError.message });
    }
    
    const totalSynced = commandesCount + savCount;
    const totalErrors = commandesErrors.length + savErrors.length;
    
    // Update sync status with success
    await supabase.from('sync_status').update({
      status: 'success',
      completed_at: new Date().toISOString(),
      records_synced: totalSynced,
      error_details: totalErrors > 0 ? { commandesErrors, savErrors } : null
    }).eq('id', syncRecord?.id);

    // If there were errors syncing some rows, send a notification
    if (totalErrors > 0) {
      await sendErrorNotification(
        `Synced ${totalSynced} records but encountered ${totalErrors} errors`,
        { commandesErrors, savErrors },
        'Google Sheets Webhook'
      );
    }

    console.log(`Sync completed: ${commandesCount} commandes, ${savCount} SAV records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Synchronisation automatique réussie',
        counts: {
          commandes: commandesCount,
          sav: savCount
        },
        warnings: totalErrors > 0 ? `${totalErrors} rows skipped due to errors` : null
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Sync error:', error.message);
    
    // Update sync status with error
    await supabase.from('sync_status').update({
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: error.message,
      error_details: { stack: error.stack }
    }).eq('id', syncRecord?.id);
    
    // Send error notification
    await sendErrorNotification(
      error.message,
      { stack: error.stack },
      'Google Sheets Webhook'
    );
    
    return new Response(
      JSON.stringify({ error: 'Une erreur est survenue lors de la synchronisation' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
