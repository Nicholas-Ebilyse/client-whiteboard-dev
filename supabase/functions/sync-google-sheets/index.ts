import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleSheetsCredentials { client_email: string; private_key: string; }

function tryParseServiceAccountKey(key: string): GoogleSheetsCredentials {
  const trimmed = key.trim();
  try { return JSON.parse(trimmed); } catch (err) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error(`Invalid secret format`);
    let currentContent = trimmed.substring(firstBrace, lastBrace + 1);
    while (currentContent.length > 2) {
      try { return JSON.parse(currentContent); } catch (e) {
        const nextLastBrace = currentContent.lastIndexOf('}', currentContent.length - 2);
        if (nextLastBrace === -1) break;
        currentContent = currentContent.substring(0, nextLastBrace + 1);
      }
    }
    throw new Error(`Malformed Service Account Key`);
  }
}

function b64url(str: string): string { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function getAccessToken(credentials: GoogleSheetsCredentials): Promise<string> {
  const jwtHeader = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = { iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const jwtClaimSetEncoded = b64url(JSON.stringify(jwtClaimSet));
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  const keyData = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(credentials.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyData, new TextEncoder().encode(signatureInput));
  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const signatureEncoded = btoa(sigBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${jwtHeader}.${jwtClaimSetEncoded}.${signatureEncoded}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  if (!normalized) throw new Error('PEM empty');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function fetchSheetData(spreadsheetId: string, sheetName: string, accessToken: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Failed to fetch ${sheetName}`);
  const data = await response.json();
  return data.values || [];
}

async function ensureHeaders(spreadsheetId: string, sheetName: string, requiredHeaders: string[], accessToken: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!1:1')}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  let existingHeaders: string[] = [];
  if (response.ok) {
    const data = await response.json();
    existingHeaders = (data.values?.[0] || []).map((h: string) => h.trim());
  }
  const missingHeaders = requiredHeaders.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length === 0) return;

  const startCol = existingHeaders.length;
  const startColLetter = String.fromCharCode(65 + startCol);
  const endColLetter = String.fromCharCode(65 + startCol + missingHeaders.length - 1);
  const writeRange = existingHeaders.length === 0 ? `${sheetName}!A1:${String.fromCharCode(65 + missingHeaders.length - 1)}1` : `${sheetName}!${startColLetter}1:${endColLetter}1`;
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`;
  await fetch(writeUrl, {
    method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [missingHeaders] }),
  });
}

// ── AUDITED FULL HEADERS ──
const COMMANDES_HEADERS = ["ID", "Nom client", "Chantier", "Nom court", "Présence Client", "Type SAV", "Compétences requises", "Véhicules requis", "Matériel requis"];
const SAV_HEADERS = ['ID', 'Numéro', 'Nom du client', 'Adresse', 'Numéro de téléphone', 'Problème', 'Date', 'Est résolu'];
const TECHNICIENS_HEADERS = ['ID', "Nom d'usage", 'Prénom', 'Nom de famille', 'Interim', 'Accompagné', 'Archivé', 'Position', 'Notes libres'];
const AFFECTATIONS_HEADERS = ['ID', 'Equipe', 'Chantier', 'Date début', 'Date fin', 'Confirmé', 'Fixé', 'Commentaire'];
const ABSENCES_HEADERS = ['ID', 'Technicien', 'Date début', 'Date fin', 'Motif', 'Commentaire'];
const NOTES_HEADERS = ['ID', 'Equipe', 'Date', 'Texte', 'Météo', 'Véhicules', 'Matériel'];
const MOTIFS_HEADERS = ['ID', 'Nom', 'Créé le'];
const VEHICULES_HEADERS = ['ID', 'Nom', 'Immatriculation', 'Statut', 'Créé le'];
const MATERIEL_HEADERS = ['ID', 'Nom', 'Référence', 'Statut', 'Créé le'];

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  return null;
}

function parseCsvArray(str: string | undefined | null): string[] {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const responseHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'X-Edge-Version': '2026.04.05.MASTER_IMPORT' };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers: responseHeaders });
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Configuration manquante');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: syncRecord } = await supabaseAdmin.from('sync_status').insert({ sync_type: 'google_sheets', status: 'running', started_at: new Date().toISOString() }).select().single();
    const isServiceRole = authHeader.includes(supabaseServiceKey);
    let isAdmin = isServiceRole;
    if (!isServiceRole) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: 'Token invalide' }), { status: 401, headers: responseHeaders });
      const { data: adminCheck } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (adminCheck) isAdmin = true;
    }
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Accès admin requis' }), { status: 403, headers: responseHeaders });

    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;
    if (!spreadsheetId) {
      const { data: setting } = await supabaseAdmin.from('global_settings').select('value').eq('key', 'google_spreadsheet_id').maybeSingle();
      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
    }

    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY_V2');
    if (!serviceAccountKey) throw new Error('Service account non configuré');
    const credentials = tryParseServiceAccountKey(serviceAccountKey);
    const accessToken = await getAccessToken(credentials);
    const supabase = supabaseAdmin;

    // ── Pre-fetch Maps for Name Translation ──
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

    function mapNamesToIds(csvStr: string | null | undefined, map: Record<string, string>): string[] {
      return parseCsvArray(csvStr).map(name => map[name] || name);
    }

    // ── 1. Techniciens ──
    let techCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Techniciens', TECHNICIENS_HEADERS, accessToken);
      const techData = await fetchSheetData(spreadsheetId, 'Techniciens', accessToken);
      if (techData.length > 1) {
        const h = techData[0];
        const validIds: string[] = [];
        for (let i = 1; i < techData.length; i++) {
          const row = techData[i];
          const name = row[h.indexOf("Nom d'usage")]?.trim() || row[h.indexOf('Nom')]?.trim();
          if (!name) continue;

          const { data } = await supabase.from('technicians').upsert({
            id: row[h.indexOf('ID')]?.trim() || undefined,
            name,
            first_name: h.indexOf('Prénom') >= 0 ? row[h.indexOf('Prénom')]?.trim() : null,
            last_name: h.indexOf('Nom de famille') >= 0 ? row[h.indexOf('Nom de famille')]?.trim() : null,
            is_temp: row[h.indexOf('Interim')]?.toUpperCase() === 'TRUE',
            is_accompanied: h.indexOf('Accompagné') >= 0 && row[h.indexOf('Accompagné')]?.toUpperCase() === 'TRUE',
            is_archived: h.indexOf('Archivé') >= 0 && row[h.indexOf('Archivé')]?.toUpperCase() === 'TRUE',
            position: h.indexOf('Position') >= 0 ? parseInt(row[h.indexOf('Position')] || '0', 10) : 0,
            skills: h.indexOf('Notes libres') >= 0 ? row[h.indexOf('Notes libres')]?.trim() : null,
          }, { onConflict: 'id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          techCount++;
        }
        if (validIds.length > 0) await supabase.from('technicians').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Tech sync error:', e); }

    // ── 2. Commandes ──
    let commandesCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Commandes', COMMANDES_HEADERS, accessToken);
      const data = await fetchSheetData(spreadsheetId, 'Commandes', accessToken);
      if (data.length > 1) {
        const h = data[0];
        const validIds: string[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const id = row[h.indexOf('ID')]?.trim();
          const client = row[h.indexOf('Nom client')]?.trim();
          const chantier = row[h.indexOf('Chantier')]?.trim();
          if (!client) continue;

          const payload = {
            client, chantier,
            display_name: h.indexOf('Nom court') >= 0 ? row[h.indexOf('Nom court')]?.trim() : null,
            client_presence: h.indexOf('Présence Client') >= 0 ? row[h.indexOf('Présence Client')]?.trim() : null,
            sav_type: h.indexOf('Type SAV') >= 0 ? row[h.indexOf('Type SAV')]?.trim() : null,
            required_skills: parseCsvArray(row[h.indexOf('Compétences requises')]),
            required_vehicles: mapNamesToIds(row[h.indexOf('Véhicules requis')], vNameMap),
            required_equipment: mapNamesToIds(row[h.indexOf('Matériel requis')], eNameMap)
          };

          if (id) {
            const { data: res } = await supabase.from('commandes').upsert({ id, ...payload }, { onConflict: 'id' }).select('id').single();
            if (res?.id) validIds.push(res.id);
          } else {
            const { data: res } = await supabase.from('commandes').insert(payload).select('id').single();
            if (res?.id) validIds.push(res.id);
          }
          commandesCount++;
        }
        if (validIds.length > 0) await supabase.from('commandes').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Commandes sync error:', e); }

    // ── 3. SAV ──
    let savCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'SAV', SAV_HEADERS, accessToken);
      const savData = await fetchSheetData(spreadsheetId, 'SAV', accessToken);
      if (savData.length > 1) {
        const h = savData[0];
        const validIds: string[] = [];
        for (let i = 1; i < savData.length; i++) {
          const row = savData[i];
          const extId = row[h.indexOf('ID')]?.trim();
          if (!extId) continue;
          const { data } = await supabase.from('sav').upsert({
            external_id: extId,
            numero: row[h.indexOf('Numéro')] ? parseInt(row[h.indexOf('Numéro')], 10) : i,
            nom_client: row[h.indexOf('Nom du client')]?.trim(),
            adresse: row[h.indexOf('Adresse')]?.trim(),
            telephone: row[h.indexOf('Numéro de téléphone')]?.trim(),
            probleme: row[h.indexOf('Problème')]?.trim(),
            date: parseDate(row[h.indexOf('Date')]?.trim()),
            est_resolu: row[h.indexOf('Est résolu')]?.toUpperCase() === 'TRUE',
          }, { onConflict: 'external_id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          savCount++;
        }
        if (validIds.length > 0) await supabase.from('sav').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('SAV sync error:', e); }

    // ── 4. Affectations ──
    let assignmentCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Affectations', AFFECTATIONS_HEADERS, accessToken);
      const assignData = await fetchSheetData(spreadsheetId, 'Affectations', accessToken);
      if (assignData.length > 1) {
        const { data: cmds } = await supabase.from('commandes').select('id, client, chantier, display_name');
        const h = assignData[0];
        const validIds: string[] = [];
        for (let i = 1; i < assignData.length; i++) {
          const row = assignData[i];
          const id = row[h.indexOf('ID')]?.trim();
          const commandeId = row[h.indexOf('Chantier')]?.trim() || null;
          const commande = cmds?.find(c => c.id === commandeId);
          const displayName = commande?.display_name || (commande ? `${commande.client} - ${commande.chantier}` : 'Nouvelle affectation');
          const { data } = await supabase.from('assignments').upsert({
            id: id && id.length > 10 ? id : undefined,
            team_id: row[h.indexOf('Equipe')]?.trim() || null,
            commande_id: commandeId,
            name: displayName,
            start_date: parseDate(row[h.indexOf('Date début')]?.trim()),
            end_date: parseDate(row[h.indexOf('Date fin')]?.trim()) || parseDate(row[h.indexOf('Date début')]?.trim()),
            is_confirmed: h.indexOf('Confirmé') >= 0 && row[h.indexOf('Confirmé')]?.toUpperCase() === 'TRUE',
            is_fixed: h.indexOf('Fixé') >= 0 && row[h.indexOf('Fixé')]?.toUpperCase() === 'TRUE',
            comment: row[h.indexOf('Commentaire')]?.trim(),
          }, { onConflict: 'id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          assignmentCount++;
        }
        if (validIds.length > 0) await supabase.from('assignments').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Assignment sync error:', e); }

    // ── 5. Motifs ──
    let motifCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Motifs', MOTIFS_HEADERS, accessToken);
      const motifData = await fetchSheetData(spreadsheetId, 'Motifs', accessToken);
      if (motifData.length > 1) {
        const h = motifData[0];
        const validIds: string[] = [];
        for (let i = 1; i < motifData.length; i++) {
          const row = motifData[i];
          const id = row[h.indexOf('ID')]?.trim();
          const name = row[h.indexOf('Nom')]?.trim();
          if (!name) continue;
          if (id && /^[0-9a-f-]{36}$/i.test(id)) {
            const { data } = await supabase.from('absence_motives').upsert({ id, name }, { onConflict: 'id' }).select('id').single();
            if (data?.id) validIds.push(data.id);
          } else {
            const { data } = await supabase.from('absence_motives').upsert({ name }, { onConflict: 'name' }).select('id').single();
            if (data?.id) validIds.push(data.id);
          }
          motifCount++;
        }
        if (validIds.length > 0) await supabase.from('absence_motives').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Motif sync error:', e); }

    // ── 6. Absences ──
    let absenceCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Absences', ABSENCES_HEADERS, accessToken);
      const absenceData = await fetchSheetData(spreadsheetId, 'Absences', accessToken);
      if (absenceData.length > 1) {
        const h = absenceData[0];
        const validIds: string[] = [];
        for (let i = 1; i < absenceData.length; i++) {
          const row = absenceData[i];
          const id = row[h.indexOf('ID')]?.trim();
          const { data, error } = await supabase.from('absences').upsert({
            id: id && id.length > 10 ? id : undefined,
            technician_id: row[h.indexOf('Technicien')]?.trim() || null,
            start_date: parseDate(row[h.indexOf('Date début')]?.trim()),
            end_date: parseDate(row[h.indexOf('Date fin')]?.trim()) || parseDate(row[h.indexOf('Date début')]?.trim()),
            motive_id: row[h.indexOf('Motif')]?.trim() || null,
          }, { onConflict: 'id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          if (!error) absenceCount++;
        }
        if (validIds.length > 0) await supabase.from('absences').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Absence sync error:', e); }

    // ── 7. Notes ──
    let noteCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Notes', NOTES_HEADERS, accessToken);
      const noteData = await fetchSheetData(spreadsheetId, 'Notes', accessToken);
      if (noteData.length > 1) {
        const h = noteData[0];
        const validIds: string[] = [];
        for (let i = 1; i < noteData.length; i++) {
          const row = noteData[i];
          if (!row[h.indexOf('Texte')]?.trim() && !row[h.indexOf('Véhicules')]?.trim() && !row[h.indexOf('Matériel')]?.trim()) continue;

          const { data } = await supabase.from('notes').upsert({
            id: row[h.indexOf('ID')]?.trim() && row[h.indexOf('ID')]?.trim().length > 10 ? row[h.indexOf('ID')]?.trim() : undefined,
            team_id: row[h.indexOf('Equipe')]?.trim() || null,
            start_date: parseDate(row[h.indexOf('Date')]?.trim()),
            end_date: parseDate(row[h.indexOf('Date')]?.trim()),
            text: row[h.indexOf('Texte')]?.trim() || "",
            weather_condition: h.indexOf('Météo') >= 0 ? row[h.indexOf('Météo')]?.trim() : null,
            vehicle_ids: mapNamesToIds(h.indexOf('Véhicules') >= 0 ? row[h.indexOf('Véhicules')] : '', vNameMap),
            equipment_ids: mapNamesToIds(h.indexOf('Matériel') >= 0 ? row[h.indexOf('Matériel')] : '', eNameMap)
          }, { onConflict: 'id' }).select('id').single();

          if (data?.id) validIds.push(data.id);
          noteCount++;
        }
        if (validIds.length > 0) await supabase.from('notes').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Note sync error:', e); }

    // ── 8. Véhicules ──
    let vehiculesCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Véhicules', VEHICULES_HEADERS, accessToken);
      const vehData = await fetchSheetData(spreadsheetId, 'Véhicules', accessToken);
      if (vehData.length > 1) {
        const h = vehData[0];
        const validIds: string[] = [];
        for (let i = 1; i < vehData.length; i++) {
          const row = vehData[i];
          const name = row[h.indexOf('Nom')]?.trim();
          if (!name) continue;
          const { data } = await supabase.from('vehicles').upsert({
            id: row[h.indexOf('ID')]?.trim() && row[h.indexOf('ID')]?.trim().length > 10 ? row[h.indexOf('ID')]?.trim() : undefined,
            name,
            license_plate: row[h.indexOf('Immatriculation')]?.trim() || null,
            status: row[h.indexOf('Statut')]?.trim() || 'Actif',
          }, { onConflict: 'id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          vehiculesCount++;
        }
        if (validIds.length > 0) await supabase.from('vehicles').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Vehicules sync error:', e); }

    // ── 9. Matériel ──
    let materielCount = 0;
    try {
      await ensureHeaders(spreadsheetId, 'Matériel', MATERIEL_HEADERS, accessToken);
      const matData = await fetchSheetData(spreadsheetId, 'Matériel', accessToken);
      if (matData.length > 1) {
        const h = matData[0];
        const validIds: string[] = [];
        for (let i = 1; i < matData.length; i++) {
          const row = matData[i];
          const name = row[h.indexOf('Nom')]?.trim();
          if (!name) continue;
          const { data } = await supabase.from('equipment').upsert({
            id: row[h.indexOf('ID')]?.trim() && row[h.indexOf('ID')]?.trim().length > 10 ? row[h.indexOf('ID')]?.trim() : undefined,
            name,
            reference: row[h.indexOf('Référence')]?.trim() || null,
            status: row[h.indexOf('Statut')]?.trim() || 'Actif',
          }, { onConflict: 'id' }).select('id').single();
          if (data?.id) validIds.push(data.id);
          materielCount++;
        }
        if (validIds.length > 0) await supabase.from('equipment').delete().not('id', 'in', `(${validIds.join(',')})`);
      }
    } catch (e) { console.error('Materiel sync error:', e); }

    // ── 10. Matrice Compétences ──
    let matriceCount = 0;
    try {
      const matrixData = await fetchSheetData(spreadsheetId, 'Matrice Compétences', accessToken);
      if (matrixData.length > 1) {
        const h = matrixData[0];
        const idIdx = h.indexOf('ID');
        const nomIdx = h.indexOf("Nom d'usage") >= 0 ? h.indexOf("Nom d'usage") : h.indexOf('Nom');
        const fixedCols = ['ID', "Nom d'usage", 'Nom'];
        const skillCols = h.map((colName, idx) => ({ name: colName, idx })).filter(c => !fixedCols.includes(c.name) && c.name.trim() !== "");

        for (let i = 1; i < matrixData.length; i++) {
          const row = matrixData[i];
          const techId = idIdx >= 0 ? row[idIdx]?.trim() : null;
          const techName = nomIdx >= 0 ? row[nomIdx]?.trim() : null;
          if (!techId && !techName) continue;

          const detailed_skills: Record<string, string> = {};
          skillCols.forEach(col => {
            const val = row[col.idx]?.trim();
            if (val === 'Oui' || val === 'Partiel' || val === 'Non') detailed_skills[col.name] = val;
          });

          if (techId && techId.length > 10) {
            await supabase.from('technicians').update({ detailed_skills }).eq('id', techId);
            matriceCount++;
          } else if (techName) {
            await supabase.from('technicians').update({ detailed_skills }).eq('name', techName);
            matriceCount++;
          }
        }
      }
    } catch (e) { console.error('Matrice sync error:', e); }

    const totalCount = techCount + commandesCount + savCount + assignmentCount + absenceCount + noteCount + motifCount + vehiculesCount + materielCount + matriceCount;
    if (syncRecord) await supabaseAdmin.from('sync_status').update({ status: 'success', completed_at: new Date().toISOString(), records_synced: totalCount }).eq('id', syncRecord.id);

    return new Response(JSON.stringify({ success: true, message: 'Synchronisation complète réussie', counts: { techniciens: techCount, commandes: commandesCount, sav: savCount, affectations: assignmentCount, absences: absenceCount, notes: noteCount, vehicules: vehiculesCount, materiel: materielCount, matrice: matriceCount } }), { status: 200, headers: responseHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: responseHeaders });
  }
});