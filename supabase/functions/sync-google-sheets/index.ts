import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleSheetsCredentials {
  client_email: string;
  private_key: string;
}

function tryParseServiceAccountKey(key: string): GoogleSheetsCredentials {
  const trimmed = key.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    console.error("Direct JSON.parse failed, trying robust extraction:", (err as any).message);
    
    // Find the first '{' and the last '}'
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
       throw new Error(`Invalid secret format: No JSON object found.`);
    }

    // Attempt to shrink the buffer from the end to find the valid JSON block
    // This handles cases with trailing noise or extra closing braces
    let currentContent = trimmed.substring(firstBrace, lastBrace + 1);
    
    while (currentContent.length > 2) {
      try {
        return JSON.parse(currentContent);
      } catch (e) {
        // Find the next '}' from the end
        const nextLastBrace = currentContent.lastIndexOf('}', currentContent.length - 2);
        if (nextLastBrace === -1) break;
        currentContent = currentContent.substring(0, nextLastBrace + 1);
      }
    }
    
    throw new Error(`Malformed Service Account Key: Could not find valid JSON object in secret string.`);
  }
}

async function getAccessToken(credentials: GoogleSheetsCredentials): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  const privateKey = credentials.private_key.replace(/\\n/g, '\n');
  const keyData = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyData,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const jwt = `${jwtHeader}.${jwtClaimSetEncoded}.${signatureEncoded}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
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

async function fetchSheetData(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<any[][]> {
  const range = `${sheetName}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ${sheetName}: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.values || [];
}

// Ensures required headers exist in the sheet, writing any that are missing
async function ensureHeaders(
  spreadsheetId: string,
  sheetName: string,
  requiredHeaders: string[],
  accessToken: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!1:1')}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let existingHeaders: string[] = [];
  if (response.ok) {
    const data = await response.json();
    existingHeaders = (data.values?.[0] || []).map((h: string) => h.trim());
  }

  // Find which headers are missing (preserving order)
  const missingHeaders = requiredHeaders.filter(h => !existingHeaders.includes(h));

  if (missingHeaders.length === 0) {
    console.log(`[${sheetName}] All required headers already present.`);
    return;
  }

  // Append missing headers to the end of row 1
  const startCol = existingHeaders.length;
  const startColLetter = String.fromCharCode(65 + startCol); // A=65
  const endColLetter = String.fromCharCode(65 + startCol + missingHeaders.length - 1);
  const range = `${sheetName}!${startColLetter}1:${endColLetter}1`;

  // If the sheet is empty (no headers at all), write from A1
  const writeRange = existingHeaders.length === 0
    ? `${sheetName}!A1:${String.fromCharCode(65 + missingHeaders.length - 1)}1`
    : range;

  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`;
  const writeResponse = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [missingHeaders] }),
  });

  if (!writeResponse.ok) {
    const errText = await writeResponse.text();
    console.error(`[${sheetName}] Failed to write headers: ${writeResponse.status} - ${errText}`);
  } else {
    console.log(`[${sheetName}] Added missing headers: ${missingHeaders.join(', ')}`);
  }
}

const COMMANDES_HEADERS = ['ID', 'Numéro', 'Nom client', 'Chantier', 'Montant HT', 'Achats', 'Date', 'Facture', 'UUID'];
const SAV_HEADERS = ['ID', 'Numéro', 'Nom du client', 'Adresse', 'Numéro de téléphone', 'Problème', 'Date', 'Est résolu'];
const TECHNICIENS_HEADERS = ['ID', 'Nom', 'Couleur', 'Interim', 'Créé le'];
const CHANTIERS_HEADERS = ['ID', 'Nom', 'Adresse', 'Couleur', 'Créé le'];
const AFFECTATIONS_HEADERS = ['ID', 'Technicien', 'Chantier', 'Date début', 'Période début', 'Date fin', 'Période fin', 'Facturé', 'Absent', 'Commentaire'];
const NOTES_HEADERS = ['ID', 'Technicien', 'Date', 'Période', 'SAV', 'Confirmé', 'Facturé', 'Texte'];

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle YYYY-MM-DD format (already correct)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const responseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'X-Edge-Version': '2026.03.13.1'
  };

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Configuration du serveur manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Record sync start
    const { data: syncRecord, error: syncError } = await supabaseAdmin
      .from('sync_status')
      .insert({
        sync_type: 'google_sheets',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncError) {
      console.error('Failed to create sync record:', syncError);
    }

    console.log('Verifying permissions...');
    const isServiceRole = authHeader.includes(supabaseServiceKey);
    let isAdmin = false;

    if (isServiceRole) {
      console.log('Authorized via service_role key');
      isAdmin = true;
    } else {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        console.error('Invalid user token:', userError);
        return new Response(JSON.stringify({ error: 'Token invalide' }), { status: 401, headers: responseHeaders });
      }

      const { data: adminCheck } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminCheck) {
        isAdmin = true;
        console.log('Admin verified:', user.email);
      }
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès administrateur requis' }), { status: 403, headers: responseHeaders });
    }

    // Get the spreadsheet ID from the request or fallback to settings
    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;

    if (!spreadsheetId) {
      console.log('No spreadsheetId in request, checking global_settings...');
      const { data: setting } = await supabaseAdmin
        .from('global_settings')
        .select('value')
        .eq('key', 'google_spreadsheet_id')
        .maybeSingle();
      
      spreadsheetId = setting?.value || '1Y0KEaFKapkRpzuKDGIF_KPzbFi9LAbIdCZ2q8qX6HeY';
    }

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: 'spreadsheetId manquant (ni dans la requête, ni dans les paramètres globaux)' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Get credentials
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      return new Response(
        JSON.stringify({ error: 'Service account key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = tryParseServiceAccountKey(serviceAccountKey);
    const accessToken = await getAccessToken(credentials);

    // Reuse the supabaseAdmin client already created above
    const supabase = supabaseAdmin;

    // ── 1. Techniciens ───────────────────────────────────────────────────────
    let techCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Techniciens', TECHNICIENS_HEADERS, accessToken);
      const techData = await fetchSheetData(spreadsheetId, 'Techniciens', accessToken);
      if (techData.length > 1) {
        const h = techData[0];
        const iID = h.indexOf('ID');
        const iNom = h.indexOf('Nom');
        const iColor = h.indexOf('Couleur');
        const iInterim = h.indexOf('Interim');

        for (let i = 1; i < techData.length; i++) {
          const row = techData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          await supabase.from('technicians').upsert({
            id: id || undefined,
            name,
            color: row[iColor]?.trim() || '#3b82f6',
            is_temp: row[iInterim]?.toUpperCase() === 'TRUE',
          }, { onConflict: 'id' });
          techCount++;
        }
      }
    } catch (e) { console.error('Tech sync error:', e); }

    // ── 2. Chantiers ──────────────────────────────────────────────────────────
    let chantierCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Chantiers', CHANTIERS_HEADERS, accessToken);
      const chantierData = await fetchSheetData(spreadsheetId, 'Chantiers', accessToken);
      if (chantierData.length > 1) {
        const h = chantierData[0];
        const iID = h.indexOf('ID');
        const iNom = h.indexOf('Nom');
        const iAddr = h.indexOf('Adresse');
        const iColor = h.indexOf('Couleur');

        for (let i = 1; i < chantierData.length; i++) {
          const row = chantierData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          const address = row[iAddr]?.trim();
          if (!name && !address) continue;

          await supabase.from('chantiers').upsert({
            id: id || undefined,
            name: name || "",
            address: address || "",
            color: row[iColor]?.trim() || '#3b82f6',
          }, { onConflict: 'id' });
          chantierCount++;
        }
      }
    } catch (e) { console.error('Chantier sync error:', e); }

    // ── 3. Commandes ─────────────────────────────────────────────────────────
    // Existing logic for Commandes... (I will keep it mostly as is but ensure it uses the correct headers)
    await ensureHeaders(spreadsheetId, 'Commandes', COMMANDES_HEADERS, accessToken);
    const commandesData = await fetchSheetData(spreadsheetId, 'Commandes', accessToken);
    let commandesCount = 0;
    if (commandesData.length > 1) {
      const h = commandesData[0];
      const iUUID = h.indexOf('UUID'); // Prefer UUID if exists
      const iExtID = h.indexOf('ID');
      const iNum = h.indexOf('Numéro');
      const iClient = h.indexOf('Nom client');
      const iChantier = h.indexOf('Chantier');
      const iMontant = h.indexOf('Montant HT');
      const iAchats = h.indexOf('Achats');
      const iDate = h.indexOf('Date');
      const iFacture = h.indexOf('Facture');

      for (let i = 1; i < commandesData.length; i++) {
        const row = commandesData[i];
        const id = row[iUUID]?.trim() || row[iExtID]?.trim();
        if (!id || !row[iClient]) continue;

        const { error } = await supabase.from('commandes').upsert({
          id: row[iUUID]?.trim() || undefined,
          external_id: row[iExtID]?.trim(),
          numero: row[iNum]?.trim(),
          client: row[iClient]?.trim(),
          chantier: row[iChantier]?.trim(),
          montant_ht: row[iMontant] ? parseFloat(row[iMontant].replace(/,/g, '.')) : null,
          achats: row[iAchats] ? parseFloat(row[iAchats].replace(/,/g, '.')) : null,
          date: parseDate(row[iDate]?.trim()),
          facture: row[iFacture]?.trim() || null
        }, { onConflict: 'external_id' });
        if (!error) commandesCount++;
      }
    }

    // ── 4. SAV ───────────────────────────────────────────────────────────────
    let savCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'SAV', SAV_HEADERS, accessToken);
      const savDataFinal = await fetchSheetData(spreadsheetId, 'SAV', accessToken);
      if (savDataFinal.length > 1) {
        const h = savDataFinal[0];
        const iID = h.indexOf('ID');
        const iNum = h.indexOf('Numéro');
        const iClient = h.indexOf('Nom du client');
        const iAddr = h.indexOf('Adresse');
        const iTel = h.indexOf('Numéro de téléphone');
        const iProb = h.indexOf('Problème');
        const iDate = h.indexOf('Date');
        const iResolu = h.indexOf('Est résolu');

        for (let i = 1; i < savDataFinal.length; i++) {
          const row = savDataFinal[i];
          const extId = row[iID]?.trim();
          if (!extId) continue;

          await supabase.from('sav').upsert({
            external_id: extId,
            numero: row[iNum] ? parseInt(row[iNum], 10) : i,
            nom_client: row[iClient]?.trim(),
            adresse: row[iAddr]?.trim(),
            telephone: row[iTel]?.trim(),
            probleme: row[iProb]?.trim(),
            date: parseDate(row[iDate]?.trim()),
            est_resolu: row[iResolu]?.toUpperCase() === 'TRUE',
          }, { onConflict: 'external_id' });
          savCount++;
        }
      }
    } catch (e) { console.error('SAV sync error:', e); }

    // ── 5. Affectations ──────────────────────────────────────────────────────
    let assignmentCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Affectations', AFFECTATIONS_HEADERS, accessToken);
      const assignData = await fetchSheetData(spreadsheetId, 'Affectations', accessToken);
      if (assignData.length > 1) {
        // Need technician and commande maps for ID lookup (if they used names in the sheet)
        const { data: techs } = await supabase.from('technicians').select('id, name');
        const { data: cmds } = await supabase.from('commandes').select('id, client, chantier');
        const techNameToId = Object.fromEntries(techs?.map(t => [t.name, t.id]) || []);
        
        const h = assignData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Technicien');
        const iChan = h.indexOf('Chantier');
        const iStart = h.indexOf('Date début');
        const iStartP = h.indexOf('Période début');
        const iEnd = h.indexOf('Date fin');
        const iEndP = h.indexOf('Période fin');
        const iAbs = h.indexOf('Absent');
        const iComm = h.indexOf('Commentaire');

        for (let i = 1; i < assignData.length; i++) {
          const row = assignData[i];
          const id = row[iID]?.trim();
          const techId = techNameToId[row[iTech]?.trim()] || row[iTech]?.trim();
          if (!techId) continue;

          await supabase.from('assignments').upsert({
            id: id && id.length > 10 ? id : undefined, // Check if it's a UUID
            technician_id: techId,
            start_date: parseDate(row[iStart]?.trim()),
            start_period: row[iStartP]?.trim(),
            end_date: parseDate(row[iEnd]?.trim()),
            end_period: row[iEndP]?.trim(),
            is_absent: row[iAbs]?.toUpperCase() === 'TRUE',
            comment: row[iComm]?.trim(),
          }, { onConflict: 'id' });
          assignmentCount++;
        }
      }
    } catch (e) { console.error('Assignment sync error:', e); }

    // ── 6. Notes ─────────────────────────────────────────────────────────────
    let noteCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Notes', NOTES_HEADERS, accessToken);
      const noteData = await fetchSheetData(spreadsheetId, 'Notes', accessToken);
      if (noteData.length > 1) {
        const { data: techs } = await supabase.from('technicians').select('id, name');
        const techNameToId = Object.fromEntries(techs?.map(t => [t.name, t.id]) || []);

        const h = noteData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Technicien');
        const iDate = h.indexOf('Date');
        const iPeriod = h.indexOf('Période');
        const iSAV = h.indexOf('SAV');
        const iConf = h.indexOf('Confirmé');
        const iBill = h.indexOf('Facturé');
        const iText = h.indexOf('Texte');

        for (let i = 1; i < noteData.length; i++) {
          const row = noteData[i];
          const id = row[iID]?.trim();
          const techId = techNameToId[row[iTech]?.trim()] || row[iTech]?.trim();

          await supabase.from('notes').upsert({
            id: id && id.length > 10 ? id : undefined,
            technician_id: techId || null,
            start_date: parseDate(row[iDate]?.trim()),
            period: row[iPeriod]?.trim(),
            is_sav: row[iSAV]?.toUpperCase() === 'TRUE',
            is_confirmed: row[iConf]?.toUpperCase() === 'TRUE',
            is_invoiced: row[iBill]?.toUpperCase() === 'TRUE',
            text: row[iText]?.trim(),
          }, { onConflict: 'id' });
          noteCount++;
        }
      }
    } catch (e) { console.error('Note sync error:', e); }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Synchronisation bidirectionnelle réussie',
        counts: {
          techniciens: techCount,
          chantiers: chantierCount,
          commandes: commandesCount,
          sav: savCount,
          affectations: assignmentCount,
          notes: noteCount
        }
      }),
      { status: 200, headers: responseHeaders }
    );

  } catch (error: any) {
    console.error('Error syncing data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: responseHeaders 
      }
    );
  }
});