import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64Lines = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const b64Decoded = atob(b64Lines);
  const buffer = new ArrayBuffer(b64Decoded.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < b64Decoded.length; i++) {
    view[i] = b64Decoded.charCodeAt(i);
  }
  return buffer;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// ── ARRAY & TRANSLATION HELPERS ──
function parseCsvArray(str: string | undefined | null): string[] {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function mapNamesToIds(csvStr: string | null | undefined, map: Record<string, string>): string[] {
  return parseCsvArray(csvStr).map(name => map[name] || name);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncRecord: any = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Define notification helper inside serve to access supabase client
  const sendErrorNotification = async (message: string, details: any, component: string) => {
    try {
      await supabase.from('error_logs').insert({
        error_message: message,
        error_details: details,
        component: component,
        severity: 'error'
      });
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  };

  try {
    // Basic API key authentication
    const apiKey = req.headers.get('x-api-key') || req.headers.get('x-webhook-api-key');
    const expectedApiKey = Deno.env.get('WEBHOOK_API_KEY');

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting automated Google Sheets sync...');

    // Log sync start
    const { data: record, error: syncError } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'google_sheets_webhook',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (syncError) console.error('Failed to log sync start:', syncError);
    syncRecord = record;

    // Get configuration
    const { data: setting } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'google_spreadsheet_id')
      .single();

    const spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';

    // Get service account key
    const googleKeySecret = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY_V2');
    if (!googleKeySecret) {
      throw new Error('Google Sheets credentials not configured');
    }

    const credentials = JSON.parse(googleKeySecret);
    const accessToken = await getAccessToken(credentials);

    // ── PRE-FETCH NAME-TO-UUID DICTIONARIES ──
    const { data: vList } = await supabase.from('vehicles').select('id, name, license_plate, registration');
    const vNameMap: Record<string, string> = {};
    vList?.forEach((v: any) => {
      if (v.name) vNameMap[v.name.trim()] = v.id;
      if (v.license_plate) vNameMap[v.license_plate.trim()] = v.id;
      if (v.registration) vNameMap[v.registration.trim()] = v.id;
    });

    const { data: eList } = await supabase.from('equipment').select('id, name, reference');
    const eNameMap: Record<string, string> = {};
    eList?.forEach((e: any) => {
      if (e.name) eNameMap[e.name.trim()] = e.id;
      if (e.reference) eNameMap[e.reference.trim()] = e.id;
    });

    let commandesCount = 0;
    let savCount = 0;
    const commandesErrors: any[] = [];
    const savErrors: any[] = [];

    // Process Commandes
    try {
      const commandesResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Commandes`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (commandesResponse.ok) {
        const commandesData = (await commandesResponse.json()).values;

        if (commandesData && commandesData.length > 0) {
          const headers = commandesData[0];
          const idIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('id'));
          const numeroIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('numéro') || h?.toLowerCase().includes('numero'));
          const clientIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('client'));
          const chantierIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('chantier') || h?.toLowerCase().includes('adresse'));

          // ── NEW COLUMNS ──
          const displayIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('nom court'));
          const presenceIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('présence') || h?.toLowerCase().includes('presence'));
          const savTypeIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('type sav'));

          // ── ARRAY COLUMNS ──
          const skillsIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('compétences requises') || h?.toLowerCase().includes('competences requises'));
          const vehiclesIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('véhicules requis') || h?.toLowerCase().includes('vehicules requis'));
          const equipmentIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('matériel requis') || h?.toLowerCase().includes('materiel requis'));

          if (clientIndex !== -1 && chantierIndex !== -1) {
            for (let i = 1; i < commandesData.length; i++) {
              const row = commandesData[i];
              if (!row || row.length === 0) continue;

              const externalId = idIndex >= 0 ? row[idIndex]?.toString().trim() : null;
              const numero = numeroIndex >= 0 ? row[numeroIndex]?.toString().trim() || null : null;
              const client = clientIndex >= 0 ? row[clientIndex]?.toString().trim() : null;
              const chantier = chantierIndex >= 0 ? row[chantierIndex]?.toString().trim() : null;

              if (!client || !chantier) {
                commandesErrors.push({ row: i + 1, reason: 'Missing client or chantier', data: { client, chantier } });
                continue;
              }

              // ── PARSE WITH TRANSLATION MAPS ──
              const required_skills = parseCsvArray(skillsIndex >= 0 ? row[skillsIndex]?.toString() : null);
              const required_vehicles = mapNamesToIds(vehiclesIndex >= 0 ? row[vehiclesIndex]?.toString() : null, vNameMap);
              const required_equipment = mapNamesToIds(equipmentIndex >= 0 ? row[equipmentIndex]?.toString() : null, eNameMap);

              const commande = {
                external_id: externalId,
                numero: numero,
                client: client,
                chantier: chantier,
                display_name: displayIndex >= 0 ? row[displayIndex]?.toString().trim() || null : null,
                client_presence: presenceIndex >= 0 ? row[presenceIndex]?.toString().trim() || null : null,
                sav_type: savTypeIndex >= 0 ? row[savTypeIndex]?.toString().trim() || null : null,
                required_skills,
                required_vehicles,
                required_equipment
              };

              const { error } = await supabase
                .from('commandes')
                .upsert(commande, {
                  onConflict: externalId ? 'external_id' : 'id',
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
      }
    } catch (e: any) {
      console.error('Error processing Commandes:', e);
      commandesErrors.push({ error: e.message });
    }

    // Process SAV (unchanged)
    try {
      const savResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/SAV`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (savResponse.ok) {
        const savData = (await savResponse.json()).values;

        if (savData && savData.length > 0) {
          const headers = savData[0];
          const idIndex = headers.findIndex((h: string) => h?.toLowerCase() === 'id' || h?.toLowerCase() === 'external_id');
          const numeroIndex = headers.findIndex((h: string) => h?.toLowerCase() === 'numéro' || h?.toLowerCase() === 'numero');
          const clientIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('client'));
          const adresseIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('adresse'));
          const telephoneIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('téléphone') || h?.toLowerCase().includes('telephone'));
          const problemeIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('problème') || h?.toLowerCase().includes('probleme'));
          const dateIndex = headers.findIndex((h: string) => h?.toLowerCase() === 'date');
          const resoluIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('résolu') || h?.toLowerCase().includes('resolu'));

          if (idIndex !== -1 && clientIndex !== -1) {
            for (let i = 1; i < savData.length; i++) {
              const row = savData[i];
              if (!row || row.length === 0) continue;

              const externalId = row[idIndex]?.toString().trim();
              if (!externalId) continue;

              const savRecord = {
                external_id: externalId,
                numero: numeroIndex >= 0 ? parseInt(row[numeroIndex]?.toString() || '0') || null : null,
                nom_client: clientIndex >= 0 ? row[clientIndex]?.toString().trim() : null,
                adresse: adresseIndex >= 0 ? row[adresseIndex]?.toString().trim() : null,
                telephone: telephoneIndex >= 0 ? row[telephoneIndex]?.toString().trim() : null,
                probleme: problemeIndex >= 0 ? row[problemeIndex]?.toString().trim() : null,
                date: dateIndex >= 0 ? parseDate(row[dateIndex]?.toString().trim()) : null,
                est_resolu: resoluIndex >= 0 ? row[resoluIndex]?.toString().trim().toUpperCase() === 'TRUE' || row[resoluIndex]?.toString().trim().toUpperCase() === 'VRAI' : false
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
        }
      }
    } catch (e: any) {
      console.error('Error processing SAV:', e);
      savErrors.push({ error: e.message });
    }

    const totalSynced = commandesCount + savCount;
    const totalErrors = commandesErrors.length + savErrors.length;

    // Update sync status
    if (syncRecord) {
      await supabase.from('sync_status').update({
        status: totalErrors > 0 ? 'completed_with_errors' : 'success',
        completed_at: new Date().toISOString(),
        records_synced: totalSynced,
        error_details: totalErrors > 0 ? { commandesErrors, savErrors } : null
      }).eq('id', syncRecord.id);
    }

    // Send a notification
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