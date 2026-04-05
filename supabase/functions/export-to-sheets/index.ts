import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleCredentials { client_email: string; private_key: string; }

function tryParseServiceAccountKey(key: string): GoogleCredentials {
  const trimmed = key.trim();
  try { return JSON.parse(trimmed); } catch (err) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error("Invalid secret format");
    let currentContent = trimmed.substring(firstBrace, lastBrace + 1);
    while (currentContent.length > 2) {
      try { return JSON.parse(currentContent); } catch {
        const nextLastBrace = currentContent.lastIndexOf("}", currentContent.length - 2);
        if (nextLastBrace === -1) break;
        currentContent = currentContent.substring(0, nextLastBrace + 1);
      }
    }
    throw new Error(`Malformed Service Account Key`);
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  if (!normalized) throw new Error('PEM empty');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(credentials: GoogleCredentials): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iss: credentials.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now,
  }));
  const sigInput = `${header}.${payload}`;
  const keyData = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(credentials.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyData, new TextEncoder().encode(sigInput));
  const sigBytes = new Uint8Array(sig);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const sigB64 = btoa(sigBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${sigInput}.${sigB64}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) throw new Error("Failed to get Google Access Token");
  return tokenData.access_token;
}

async function writeSheet(spreadsheetId: string, sheetName: string, rows: string[][], accessToken: string, log: (msg: string) => void): Promise<void> {
  if (!rows || rows.length === 0) {
    log(`   -> Skipping ${sheetName}: No rows to write.`);
    return;
  }

  // Cast everything strictly to string to prevent Google API crash
  const safeRows = rows.map(r => r.map(c => c === null || c === undefined ? "" : String(c)));

  // 1. Check if tab exists
  const metaResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (metaResp.ok) {
    const meta = await metaResp.json();
    const existingTabs: string[] = (meta.sheets || []).map((s: any) => s.properties.title);
    if (!existingTabs.includes(sheetName)) {
      log(`   -> Tab '${sheetName}' missing. Creating it...`);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
    }
  }

  // 2. Clear old data
  const clearResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1:ZZ")}:clear`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  if (!clearResp.ok) {
    const err = await clearResp.text();
    throw new Error(`Clear failed on ${sheetName}: ${err}`);
  }

  // 3. Write new data
  const writeResp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}?valueInputOption=RAW`, {
    method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: safeRows }),
  });

  if (!writeResp.ok) {
    const errText = await writeResp.text();
    throw new Error(`Write failed on ${sheetName}: ${errText}`);
  }

  log(`   -> Successfully wrote ${safeRows.length} rows to ${sheetName}.`);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const responseHeaders = { ...corsHeaders, "Content-Type": "application/json", "X-Edge-Version": "2026.04.05.DIAGNOSTIC_EXPORT" };

  const traceLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    traceLogs.push(msg);
  };

  log("=== STARTING EXPORT DIAGNOSTIC RUN ===");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Auth requise");
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: syncRecord } = await supabase.from('sync_status').insert({ sync_type: 'google_sheets_export', status: 'running', started_at: new Date().toISOString() }).select().single();

    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;

    log(`Payload Spreadsheet ID: ${spreadsheetId || "None provided"}`);

    if (!spreadsheetId) {
      const { data: setting } = await supabase.from('global_settings').select('value').eq('key', 'google_spreadsheet_id').maybeSingle();
      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
      log(`Fallback Spreadsheet ID used: ${spreadsheetId}`);
    }

    const googleKeySecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY_V2");
    if (!googleKeySecret) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_V2 not configured");
    log("Authenticating with Google API...");
    const credentials = tryParseServiceAccountKey(googleKeySecret);
    const accessToken = await getAccessToken(credentials);
    log("Google Authentication successful.");

    // ── Pre-fetch Maps for Name Translation ──
    const { data: vList } = await supabase.from("vehicles").select("*");
    const vMap: Record<string, string> = {};
    (vList || []).forEach((v: any) => { if (v.id) vMap[v.id] = v.name || v.license_plate || v.registration || v.id; });

    const { data: eList } = await supabase.from("equipment").select("*");
    const eMap: Record<string, string> = {};
    (eList || []).forEach((e: any) => { if (e.id) eMap[e.id] = e.name || e.reference || e.id; });

    const counts: Record<string, number> = {};

    // Wrap every tab in its own try/catch so if one breaks, the others still export!

    // ── 1. Techniciens ──
    try {
      log("Fetching Techniciens...");
      const { data: technicians } = await supabase.from("technicians").select("*").order("position");
      const techRows = [
        ["ID", "Nom d'usage", "Prénom", "Nom de famille", "Interim", "Accompagné", "Archivé", "Position", "Notes libres"],
        ...(technicians || []).map((t: any) => [
          t.id || "", t.name || "", t.first_name || "", t.last_name || "",
          t.is_temp ? "TRUE" : "FALSE", t.is_accompanied ? "TRUE" : "FALSE", t.is_archived ? "TRUE" : "FALSE", t.position?.toString() || "0", t.skills || ""
        ]),
      ];
      await writeSheet(spreadsheetId, "Techniciens", techRows, accessToken, log);
      counts.techniciens = (technicians || []).length;
    } catch (e: any) { log(`ERROR on Techniciens: ${e.message}`); }

    // ── 2. Commandes ──
    try {
      log("Fetching Commandes...");
      const { data: commandes } = await supabase.from("commandes").select("*").order("client");
      const commandeRows = [
        ["ID", "Nom client", "Chantier", "Nom court", "Présence Client", "Type SAV", "Compétences requises", "Véhicules requis", "Matériel requis"],
        ...(commandes || []).map((c: any) => [
          c.id || "", c.client || "", c.chantier || "", c.display_name || "", c.client_presence || "", c.sav_type || "",
          Array.isArray(c.required_skills) ? c.required_skills.filter(Boolean).join(", ") : "",
          Array.isArray(c.required_vehicles) ? c.required_vehicles.filter(Boolean).map((id: string) => vMap[id] || id).join(", ") : "",
          Array.isArray(c.required_equipment) ? c.required_equipment.filter(Boolean).map((id: string) => eMap[id] || id).join(", ") : ""
        ]),
      ];
      await writeSheet(spreadsheetId, "Commandes", commandeRows, accessToken, log);
      counts.commandes = (commandes || []).length;
    } catch (e: any) { log(`ERROR on Commandes: ${e.message}`); }

    // ── 3. Affectations ──
    try {
      log("Fetching Affectations...");
      const { data: assignments } = await supabase.from("assignments").select("*").order("start_date", { ascending: false });
      const assignmentRows = [
        ["ID", "Equipe", "Chantier", "Date début", "Date fin", "Confirmé", "Fixé", "Commentaire"],
        ...(assignments || []).map((a: any) => [
          a.id || "", a.team_id || "", a.commande_id || "", fmtDate(a.start_date), fmtDate(a.end_date),
          a.is_confirmed ? "TRUE" : "FALSE", a.is_fixed ? "TRUE" : "FALSE", a.comment || ""
        ]),
      ];
      await writeSheet(spreadsheetId, "Affectations", assignmentRows, accessToken, log);
      counts.affectations = (assignments || []).length;
    } catch (e: any) { log(`ERROR on Affectations: ${e.message}`); }

    // ── 4. Notes ──
    try {
      log("Fetching Notes...");
      const { data: notes } = await supabase.from("notes").select("*").order("start_date", { ascending: false });
      const noteRows = [
        ["ID", "Equipe", "Date", "Texte", "Météo", "Véhicules", "Matériel"],
        ...(notes || []).map((n: any) => [
          n.id || "", n.team_id || "", fmtDate(n.start_date), n.text || "", n.weather_condition || "",
          Array.isArray(n.vehicle_ids) ? n.vehicle_ids.filter(Boolean).map((id: string) => vMap[id] || id).join(", ") : "",
          Array.isArray(n.equipment_ids) ? n.equipment_ids.filter(Boolean).map((id: string) => eMap[id] || id).join(", ") : ""
        ]),
      ];
      await writeSheet(spreadsheetId, "Notes", noteRows, accessToken, log);
      counts.notes = (notes || []).length;
    } catch (e: any) { log(`ERROR on Notes: ${e.message}`); }

    // ── 5. Matrice Compétences ──
    try {
      log("Fetching Matrice Compétences...");
      const { data: technicians } = await supabase.from("technicians").select("*");
      const { data: skillsDict } = await supabase.from("skill_definitions").select("*").order("category").order("name");
      const skillHeaders = (skillsDict || []).map((s: any) => `${s.category} - ${s.name}`);
      const matriceRows = [
        ["ID", "Nom d'usage", ...skillHeaders],
        ...(technicians || []).map((t: any) => {
          const row = [t.id || "", t.name || ""];
          const techSkills = t.detailed_skills || {};
          skillHeaders.forEach(header => row.push(techSkills[header] || ""));
          return row;
        }),
      ];
      await writeSheet(spreadsheetId, "Matrice Compétences", matriceRows, accessToken, log);
      counts.matrice = (technicians || []).length;
    } catch (e: any) { log(`ERROR on Matrice: ${e.message}`); }


    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    log(`=== EXPORT FINISHED. Total Rows Processed: ${totalCount} ===`);

    if (syncRecord) {
      await supabase.from('sync_status').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_synced: totalCount,
        error_details: { trace: traceLogs } // Saves the log to the database!
      }).eq('id', syncRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Exportation traitée",
      counts,
      trace: traceLogs
    }), { status: 200, headers: responseHeaders });

  } catch (error: any) {
    log(`CRITICAL FAILURE: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      trace: traceLogs
    }), { headers: responseHeaders, status: 500 });
  }
});