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

    let currentContent = trimmed.substring(firstBrace, lastBrace + 1);

    while (currentContent.length > 2) {
      try {
        return JSON.parse(currentContent);
      } catch (e) {
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
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!normalized) throw new Error('PEM private key is empty after stripping headers');

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

  const missingHeaders = requiredHeaders.filter(h => !existingHeaders.includes(h));

  if (missingHeaders.length === 0) {
    console.log(`[${sheetName}] All required headers already present.`);
    return;
  }

  const startCol = existingHeaders.length;
  const startColLetter = String.fromCharCode(65 + startCol);
  const endColLetter = String.fromCharCode(65 + startCol + missingHeaders.length - 1);
  const range = `${sheetName}!${startColLetter}1:${endColLetter}1`;

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

// UPGRADED HEADERS
const COMMANDES_HEADERS = ["ID", "Numéro", "Nom client", "Chantier", "Nom court", "UUID", "Présence Client", "Type SAV"];
const SAV_HEADERS = ['ID', 'Numéro', 'Nom du client', 'Adresse', 'Numéro de téléphone', 'Problème', 'Date', 'Est résolu'];
const TECHNICIENS_HEADERS = ['ID', 'Nom', 'Interim', 'Créé le', 'Accompagné', 'Compétences'];
const AFFECTATIONS_HEADERS = ['ID', 'Equipe', 'Chantier', 'Date début', 'Date fin', 'Commentaire'];
const ABSENCES_HEADERS = ['ID', 'Technicien', 'Date début', 'Date fin', 'Motif', 'Commentaire'];
const NOTES_HEADERS = ['ID', 'Equipe', 'Date', 'Texte', 'Météo'];
const MOTIFS_HEADERS = ['ID', 'Nom', 'Créé le'];
const VEHICULES_HEADERS = ['ID', 'Nom', 'Immatriculation', 'Statut', 'Créé le'];
const MATERIEL_HEADERS = ['ID', 'Nom', 'Référence', 'Statut', 'Créé le'];

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
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
    'X-Edge-Version': '2026.03.13.2' // Version bumped
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers: responseHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuration du serveur manquante' }), { status: 500, headers: responseHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: syncRecord } = await supabaseAdmin
      .from('sync_status')
      .insert({
        sync_type: 'google_sheets',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const isServiceRole = authHeader.includes(supabaseServiceKey);
    let isAdmin = isServiceRole;

    if (!isServiceRole) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: 'Token invalide' }), { status: 401, headers: responseHeaders });

      const { data: adminCheck } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminCheck) isAdmin = true;
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès administrateur requis' }), { status: 403, headers: responseHeaders });
    }

    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;

    if (!spreadsheetId) {
      const { data: setting } = await supabaseAdmin
        .from('global_settings')
        .select('value')
        .eq('key', 'google_spreadsheet_id')
        .maybeSingle();
      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
    }

    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY_V2');
    if (!serviceAccountKey) {
      return new Response(JSON.stringify({ error: 'Service account key not configured' }), { status: 500, headers: responseHeaders });
    }

    const credentials = tryParseServiceAccountKey(serviceAccountKey);
    const accessToken = await getAccessToken(credentials);
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
        const iAcc = h.indexOf('Accompagné');
        const iComp = h.indexOf('Compétences');

        for (let i = 1; i < techData.length; i++) {
          const row = techData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          await supabase.from('technicians').upsert({
            id: id || undefined,
            name,
            is_temp: row[iInterim]?.toUpperCase() === 'TRUE',
            is_accompanied: iAcc >= 0 && row[iAcc]?.toUpperCase() === 'TRUE',
            skills: iComp >= 0 ? row[iComp]?.trim() : null,
          }, { onConflict: 'id' });
          techCount++;
        }
      }
    } catch (e) { console.error('Tech sync error:', e); }

    // ── 2. Commandes ─────────────────────────────────────────────────────────
    let commandesCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Commandes', COMMANDES_HEADERS, accessToken);
      const commandesData = await fetchSheetData(spreadsheetId, 'Commandes', accessToken);

      if (commandesData.length > 1) {
        const h = commandesData[0];
        const iUUID = h.indexOf('UUID');
        const iExtID = h.indexOf('ID');
        const iNum = h.indexOf('Numéro');
        const iClient = h.indexOf('Nom client');
        const iChantier = h.indexOf('Chantier');
        const iNomCourt = h.indexOf('Nom court');
        const iPres = h.indexOf('Présence Client');
        const iSavType = h.indexOf('Type SAV');

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
            display_name: row[iNomCourt]?.trim() || undefined,
            client_presence: iPres >= 0 ? row[iPres]?.trim() : undefined,
            sav_type: iSavType >= 0 ? row[iSavType]?.trim() : undefined
          }, { onConflict: 'external_id' });
          if (!error) commandesCount++;
        }
      }
    } catch (e) { console.error('Commandes sync error:', e); }

    // ── 3. SAV ───────────────────────────────────────────────────────────────
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

    // ── 4. Affectations ──────────────────────────────────────────────────────
    let assignmentCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Affectations', AFFECTATIONS_HEADERS, accessToken);
      const assignData = await fetchSheetData(spreadsheetId, 'Affectations', accessToken);
      if (assignData.length > 1) {
        const { data: cmds } = await supabase.from('commandes').select('id, client, chantier, display_name');

        const h = assignData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Equipe');
        const iChan = h.indexOf('Chantier');
        const iStart = h.indexOf('Date début');
        const iEnd = h.indexOf('Date fin');
        const iComm = h.indexOf('Commentaire');

        for (let i = 1; i < assignData.length; i++) {
          const row = assignData[i];
          const id = row[iID]?.trim();
          let assignedTeamId = row[iTech]?.trim() || null;
          let commandeId = row[iChan]?.trim() || null;

          const commande = cmds?.find(c => c.id === commandeId);
          const displayName = commande?.display_name || (commande ? `${commande.client} - ${commande.chantier}` : 'Nouvelle affectation');

          await supabase.from('assignments').upsert({
            id: id && id.length > 10 ? id : undefined,
            team_id: assignedTeamId,
            commande_id: commandeId,
            name: displayName,
            start_date: parseDate(row[iStart]?.trim()),
            end_date: parseDate(row[iEnd]?.trim()) || parseDate(row[iStart]?.trim()),
            comment: row[iComm]?.trim(),
          }, { onConflict: 'id' });
          assignmentCount++;
        }
      }
    } catch (e) { console.error('Assignment sync error:', e); }

    // ── 5. Motifs ─────────────────────────────────────────────────────────────
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

          const isUuid = id && /^[0-9a-f-]{36}$/i.test(id);
          if (isUuid) {
            await supabase.from('absence_motives').upsert({ id, name }, { onConflict: 'id' });
          } else {
            await supabase.from('absence_motives').upsert({ name }, { onConflict: 'name' });
          }
          motifCount++;
        }
      }
    } catch (e) { console.error('Motif sync error:', e); }

    // ── 6. Absences ─────────────────────────────────────────────────────────
    let absenceCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Absences', ABSENCES_HEADERS, accessToken);
      const absenceData = await fetchSheetData(spreadsheetId, 'Absences', accessToken);
      if (absenceData.length > 1) {
        const h = absenceData[0];
        const iID = h.indexOf('ID');
        const iTech = h.indexOf('Technicien');
        const iStart = h.indexOf('Date début');
        const iEnd = h.indexOf('Date fin');
        const iMotif = h.indexOf('Motif');

        for (let i = 1; i < absenceData.length; i++) {
          const row = absenceData[i];
          const id = row[iID]?.trim();
          let assignedTechId = row[iTech]?.trim() || null;
          let motiveId = row[iMotif]?.trim() || null;

          const { error } = await supabase.from('absences').upsert({
            id: id && id.length > 10 ? id : undefined,
            technician_id: assignedTechId,
            start_date: parseDate(row[iStart]?.trim()),
            end_date: parseDate(row[iEnd]?.trim()) || parseDate(row[iStart]?.trim()),
            motive_id: motiveId,
          }, { onConflict: 'id' });

          if (!error) absenceCount++;
        }
      }
    } catch (e) { console.error('Absence sync error:', e); }

    // ── 7. Notes ─────────────────────────────────────────────────────────────
    let noteCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Notes', NOTES_HEADERS, accessToken);
      const noteData = await fetchSheetData(spreadsheetId, 'Notes', accessToken);
      if (noteData.length > 1) {
        const h = noteData[0];
        const iID = h.indexOf('ID');
        const iEquipe = h.indexOf('Equipe');
        const iDate = h.indexOf('Date');
        const iText = h.indexOf('Texte');
        const iMeteo = h.indexOf('Météo');

        for (let i = 1; i < noteData.length; i++) {
          const row = noteData[i];
          const id = row[iID]?.trim();
          let teamId = row[iEquipe]?.trim() || null;

          if (!row[iText]?.trim()) continue;

          await supabase.from('notes').upsert({
            id: id && id.length > 10 ? id : undefined,
            team_id: teamId,
            start_date: parseDate(row[iDate]?.trim()),
            end_date: parseDate(row[iDate]?.trim()),
            text: row[iText]?.trim(),
            weather_condition: iMeteo >= 0 ? row[iMeteo]?.trim() : null,
          }, { onConflict: 'id' });
          noteCount++;
        }
      }
    } catch (e) { console.error('Note sync error:', e); }

    // ── 8. Véhicules ─────────────────────────────────────────────────────────
    let vehiculesCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Véhicules', VEHICULES_HEADERS, accessToken);
      const vehData = await fetchSheetData(spreadsheetId, 'Véhicules', accessToken);
      if (vehData.length > 1) {
        const h = vehData[0];
        const iID = h.indexOf('ID');
        const iNom = h.indexOf('Nom');
        const iImm = h.indexOf('Immatriculation');
        const iStatut = h.indexOf('Statut');

        for (let i = 1; i < vehData.length; i++) {
          const row = vehData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          await supabase.from('vehicles').upsert({
            id: id && id.length > 10 ? id : undefined,
            name,
            license_plate: row[iImm]?.trim() || null,
            status: row[iStatut]?.trim() || 'Actif',
          }, { onConflict: 'id' });
          vehiculesCount++;
        }
      }
    } catch (e) { console.error('Vehicules sync error:', e); }

    // ── 9. Matériel ─────────────────────────────────────────────────────────
    let materielCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Matériel', MATERIEL_HEADERS, accessToken);
      const matData = await fetchSheetData(spreadsheetId, 'Matériel', accessToken);
      if (matData.length > 1) {
        const h = matData[0];
        const iID = h.indexOf('ID');
        const iNom = h.indexOf('Nom');
        const iRef = h.indexOf('Référence');
        const iStatut = h.indexOf('Statut');

        for (let i = 1; i < matData.length; i++) {
          const row = matData[i];
          const id = row[iID]?.trim();
          const name = row[iNom]?.trim();
          if (!name) continue;

          await supabase.from('equipment').upsert({
            id: id && id.length > 10 ? id : undefined,
            name,
            reference: row[iRef]?.trim() || null,
            status: row[iStatut]?.trim() || 'Actif',
          }, { onConflict: 'id' });
          materielCount++;
        }
      }
    } catch (e) { console.error('Materiel sync error:', e); }

    // Mark sync status as success
    const totalCount = techCount + commandesCount + savCount + assignmentCount + absenceCount + noteCount + motifCount + vehiculesCount + materielCount;
    if (syncRecord) {
      await supabaseAdmin.from('sync_status').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_synced: totalCount,
      }).eq('id', syncRecord.id);
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
          notes: noteCount,
          vehicules: vehiculesCount,
          materiel: materielCount
        }
      }),
      { status: 200, headers: responseHeaders }
    );

  } catch (error: any) {
    console.error('Error syncing data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: responseHeaders }
    );
  }
});