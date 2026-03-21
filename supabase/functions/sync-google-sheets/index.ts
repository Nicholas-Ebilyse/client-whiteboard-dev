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

function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(credentials: GoogleSheetsCredentials): Promise<string> {
  console.log('Getting access token for:', credentials.client_email);
  const jwtHeader = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const jwtClaimSetEncoded = b64url(JSON.stringify(jwtClaimSet));
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  console.log('Parsing private key, length:', credentials.private_key.length);
  const privateKey = credentials.private_key;
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
  
  // Use loop instead of spread to avoid RangeError on large arrays
  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const signatureEncoded = btoa(sigBinary)
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
  // Normalize: handle both \\n (escaped) and real newlines, strip PEM headers
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  
  if (!normalized) throw new Error('PEM private key is empty after stripping headers');
  
  // Validate base64 characters before decoding
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new Error(`PEM contains invalid base64 characters`);
  }
  
  const binary = atob(normalized);
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

const COMMANDES_HEADERS = ['ID', 'Numéro', 'Nom client', 'Chantier', 'UUID'];
const SAV_HEADERS = ['ID', 'Numéro', 'Nom du client', 'Adresse', 'Numéro de téléphone', 'Problème', 'Date', 'Est résolu'];
const TECHNICIENS_HEADERS = ['ID', 'Nom', 'Interim', 'Créé le'];
const AFFECTATIONS_HEADERS = ['ID', 'Equipe', 'Chantier', 'Date début', 'Date fin', 'Commentaire'];
const ABSENCES_HEADERS = ['ID', 'Technicien', 'Date début', 'Date fin', 'Motif', 'Commentaire'];
const NOTES_HEADERS = ['ID', 'Technicien', 'Date', 'SAV', 'Confirmé', 'Texte'];
const MOTIFS_HEADERS = ['ID', 'Nom', 'Créé le'];

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
      
      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
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
        const iInterim = h.indexOf('Interim');

        for (let i = 1; i < techData.length; i++) {
          const row = techData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          await supabase.from('technicians').upsert({
            id: id || undefined,
            name,
            is_temp: row[iInterim]?.toUpperCase() === 'TRUE',
          }, { onConflict: 'id' });
          techCount++;
        }
      }
    } catch (e) { console.error('Tech sync error:', e); }

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

      for (let i = 1; i < commandesData.length; i++) {
        const row = commandesData[i];
        const id = row[iUUID]?.trim() || row[iExtID]?.trim();
        if (!id || !row[iClient]) continue;

        const { error } = await supabase.from('commandes').upsert({
          id: row[iUUID]?.trim() || undefined,
          external_id: row[iExtID]?.trim(),
          numero: row[iNum]?.trim(),
          client: row[iClient]?.trim(),
          chantier: row[iChantier]?.trim()
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
        // Prepare tech, team, and commande maps for ID lookup
        const { data: techs } = await supabase.from('technicians').select('id, name, team_id');
        const { data: allTeams } = await supabase.from('teams').select('id, name');
        const { data: cmds } = await supabase.from('commandes').select('id, client, chantier');
        
        const techNameToObj = Object.fromEntries(techs?.map(t => [t.name, t]) || []);
        const teamNameToObj = Object.fromEntries(allTeams?.map(t => [t.name, t]) || []);
        
        // Map "Client - Chantier" to commande ID
        const cmdMap = Object.fromEntries(cmds?.map(c => [`${c.client} - ${c.chantier}`, c.id]) || []);

        const h = assignData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Equipe'); // Label is Equipe in export 
        const iChan = h.indexOf('Chantier');
        const iStart = h.indexOf('Date début');
        const iEnd = h.indexOf('Date fin');
        const iComm = h.indexOf('Commentaire');

        for (let i = 1; i < assignData.length; i++) {
          const row = assignData[i];
          const id = row[iID]?.trim();
          const workerName = row[iTech]?.trim();
          
          let assignedTechId = null;
          let assignedTeamId = null;

          if (workerName && techNameToObj[workerName]) {
            assignedTechId = techNameToObj[workerName].id;
            assignedTeamId = techNameToObj[workerName].team_id;
          } else if (workerName && teamNameToObj[workerName]) {
            assignedTeamId = teamNameToObj[workerName].id;
          } else {
            // Unmatched name or empty
            continue;
          }

          const chantierStr = row[iChan]?.trim();
          const commandeId = cmdMap[chantierStr] || null;
          
          const assignmentName = chantierStr || 'Nouvelle affectation';

          await supabase.from('assignments').upsert({
            id: id && id.length > 10 ? id : undefined,
            team_id: assignedTeamId,
            commande_id: commandeId,
            name: assignmentName,
            start_date: parseDate(row[iStart]?.trim()),
            end_date: parseDate(row[iEnd]?.trim()) || parseDate(row[iStart]?.trim()),
            comment: row[iComm]?.trim(),
          }, { onConflict: 'id' });
          assignmentCount++;
        }
      }
    } catch (e) { console.error('Assignment sync error:', e); }
    
    // ── 5b. Absences ─────────────────────────────────────────────────────────
    let absenceCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Absences', ABSENCES_HEADERS, accessToken);
      const absenceData = await fetchSheetData(spreadsheetId, 'Absences', accessToken);
      if (absenceData.length > 1) {
        const { data: techs } = await supabase.from('technicians').select('id, name, team_id');
        const { data: allTeams } = await supabase.from('teams').select('id, name');
        
        const techNameToObj = Object.fromEntries(techs?.map(t => [t.name, t]) || []);
        const teamNameToObj = Object.fromEntries(allTeams?.map(t => [t.name, t]) || []);
        
        const h = absenceData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Technicien');
        const iStart = h.indexOf('Date début');
        const iEnd = h.indexOf('Date fin');
        const iMotif = h.indexOf('Motif');
        const iComm = h.indexOf('Commentaire');

        for (let i = 1; i < absenceData.length; i++) {
          const row = absenceData[i];
          const id = row[iID]?.trim();
          const workerName = row[iTech]?.trim();

          let assignedTechId = null;

          if (workerName && techNameToObj[workerName]) {
            assignedTechId = techNameToObj[workerName].id;
          } else {
            // If the name is a team, or doesn't match a technician, we must skip.
            console.warn(`Absence import: skipping row for unknown technician '${workerName}'`);
            continue;
          }

          const motifStr = row[iMotif]?.trim();

          try {
            const { error } = await supabase.from('absences').upsert({
              id: id && id.length > 10 ? id : undefined,
              technician_id: assignedTechId,
              start_date: parseDate(row[iStart]?.trim()),
              end_date: parseDate(row[iEnd]?.trim()) || parseDate(row[iStart]?.trim()),
              reason: motifStr || 'Absence',
            }, { onConflict: 'id' });
            
            if (error) {
              console.error('Row absence sync error:', error, row);
            } else {
              absenceCount++;
            }
          } catch (rowErr) {
            console.error('Exception on row absence sync:', rowErr, row);
          }
        }
      }
    } catch (e) { console.error('Absence sync error:', e); }

    // ── 6. Notes ─────────────────────────────────────────────────────────────
    let noteCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Notes', NOTES_HEADERS, accessToken);
      const noteData = await fetchSheetData(spreadsheetId, 'Notes', accessToken);
      if (noteData.length > 1) {
        const { data: techs } = await supabase.from('technicians').select('id, name');
        const techNameToObj = Object.fromEntries(techs?.map(t => [t.name, t]) || []);

        const h = noteData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Technicien');
        const iDate = h.indexOf('Date');
        const iSAV = h.indexOf('SAV');
        const iConf = h.indexOf('Confirmé');
        const iText = h.indexOf('Texte');

        for (let i = 1; i < noteData.length; i++) {
          const row = noteData[i];
          const id = row[iID]?.trim();
          
          const workerName = row[iTech]?.trim();
          let techId = null;
          if (workerName && techNameToObj[workerName]) {
            techId = techNameToObj[workerName].id;
          }
          
          if (!row[iText]?.trim()) continue; // Skip empty notes

          await supabase.from('notes').upsert({
            id: id && id.length > 10 ? id : undefined,
            technician_id: techId,
            start_date: parseDate(row[iDate]?.trim()),
            end_date: parseDate(row[iDate]?.trim()), // Notes currently single-day in sync
            is_sav: row[iSAV]?.toUpperCase() === 'TRUE',
            is_confirmed: row[iConf]?.toUpperCase() === 'TRUE',
            text: row[iText]?.trim(),
          }, { onConflict: 'id' });
          noteCount++;
        }
      }
    } catch (e) { console.error('Note sync error:', e); }

    // ── 7. Motifs ─────────────────────────────────────────────────────────────
    let motifCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Motifs', MOTIFS_HEADERS, accessToken);
      const motifData = await fetchSheetData(spreadsheetId, 'Motifs', accessToken);
      if (motifData.length > 1) {
        const h = motifData[0];
        const iID = h.indexOf('ID');
        const iNom = h.indexOf('Nom');

        for (let i = 1; i < motifData.length; i++) {
          const row = motifData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          // If ID is a valid UUID, upsert by ID; otherwise insert by name (new row from Sheets)
          const isUuid = id && /^[0-9a-f-]{36}$/i.test(id);
          if (isUuid) {
            await supabase.from('absence_motives').upsert({ id, name }, { onConflict: 'id' });
          } else {
            // New motive added directly in Sheets — insert it (skip if name already exists)
            await supabase.from('absence_motives').upsert({ name }, { onConflict: 'name' });
          }
          motifCount++;
        }
      }
    } catch (e) { console.error('Motif sync error:', e); }

    // Always mark sync status as success
    const totalCount = techCount + commandesCount + savCount + assignmentCount + absenceCount + noteCount + motifCount;
    if (syncRecord) {
      await supabaseAdmin.from('sync_status').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_synced: totalCount,
      }).eq('id', syncRecord.id);
    } else {
      // Fallback: find the latest running record by ID, then update it
      const { data: latestRunning } = await supabaseAdmin
        .from('sync_status')
        .select('id')
        .eq('sync_type', 'google_sheets')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      if (latestRunning) {
        await supabaseAdmin.from('sync_status').update({
          status: 'success',
          completed_at: new Date().toISOString(),
          records_synced: totalCount,
        }).eq('id', latestRunning.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Synchronisation bidirectionnelle réussie',
        counts: {
          techniciens: techCount,
          commandes: commandesCount,
          sav: savCount,
          affectations: assignmentCount,
          absences: absenceCount,
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