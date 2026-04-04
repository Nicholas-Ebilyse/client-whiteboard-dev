import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

function tryParseServiceAccountKey(key: string): GoogleCredentials {
  const trimmed = key.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Invalid secret format: No JSON object found.");
    }
    let currentContent = trimmed.substring(firstBrace, lastBrace + 1);
    while (currentContent.length > 2) {
      try {
        return JSON.parse(currentContent);
      } catch {
        const nextLastBrace = currentContent.lastIndexOf("}", currentContent.length - 2);
        if (nextLastBrace === -1) break;
        currentContent = currentContent.substring(0, nextLastBrace + 1);
      }
    }
    throw new Error(`Malformed Service Account Key: ${(err as any).message}`);
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!normalized) throw new Error('PEM private key is empty after stripping headers');
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new Error('PEM contains invalid base64 characters');
  }

  const binary = atob(normalized);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(credentials: GoogleCredentials): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const sigInput = `${header}.${payload}`;
  const keyData = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyData, new TextEncoder().encode(sigInput));
  const sigBytes = new Uint8Array(sig);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const sigB64 = btoa(sigBinary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${sigInput}.${sigB64}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function writeSheet(
  spreadsheetId: string,
  sheetName: string,
  rows: string[][],
  accessToken: string
): Promise<void> {
  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaResp.json();
  const existingTabs: string[] = (meta.sheets || []).map((s: any) => s.properties.title);

  if (!existingTabs.includes(sheetName)) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  }

  if (rows.length === 0) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1:ZZ")}:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    }
  );

  const writeResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!writeResp.ok) {
    const errText = await writeResp.text();
    throw new Error(`Failed to write to ${sheetName}: ${writeResp.status} - ${errText}`);
  }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Edge-Version": "2026.04.04.1",
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: responseHeaders });
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({ sync_type: 'google_sheets_export', status: 'running', started_at: new Date().toISOString() })
      .select().single();

    const isServiceRole = authHeader.includes(supabaseKey);
    let isAdmin = isServiceRole;

    if (!isServiceRole) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: responseHeaders });
      const { data: adminCheck } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (adminCheck) isAdmin = true;
    }

    if (!isAdmin) return new Response(JSON.stringify({ error: "Accès admin requis" }), { status: 403, headers: responseHeaders });

    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;

    if (!spreadsheetId) {
      const { data: setting } = await supabase.from('global_settings').select('value').eq('key', 'google_spreadsheet_id').maybeSingle();
      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
    }

    const googleKeySecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY_V2");
    if (!googleKeySecret) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_V2 not configured");
    const credentials = tryParseServiceAccountKey(googleKeySecret);
    const accessToken = await getAccessToken(credentials);

    // ── 1. Techniciens ───────────────────────────────────────────────────────
    const { data: technicians, error: techError } = await supabase
      .from("technicians")
      .select("id, name, first_name, last_name, is_temp, created_at, is_accompanied, skills, detailed_skills")
      .order("position");

    if (techError) throw new Error(`Erreur DB Techniciens: ${techError.message}`);

    const techRows: string[][] = [
      ["ID", "Nom d'usage", "Prénom", "Nom de famille", "Interim", "Créé le", "Accompagné", "Notes libres"],
      ...(technicians || []).map((t: any) => [
        t.id,
        t.name || "Sans nom",
        t.first_name || "",
        t.last_name || "",
        t.is_temp ? "TRUE" : "FALSE",
        fmtDate(t.created_at),
        t.is_accompanied ? "TRUE" : "FALSE",
        t.skills || "" // <-- Restored free-text notes!
      ]),
    ];
    await writeSheet(spreadsheetId, "Techniciens", techRows, accessToken);

    // ── 2. Commandes ─────────────────────────────────────────────────────────
    const { data: commandes } = await supabase.from("commandes").select("*").order("client");
    const commandeRows: string[][] = [
      ["ID", "Nom client", "Chantier", "Nom court", "Présence Client", "Type SAV"],
      ...(commandes || []).map((c: any) => [c.id, c.client || "", c.chantier || "", c.display_name || "", c.client_presence || "", c.sav_type || ""]),
    ];
    await writeSheet(spreadsheetId, "Commandes", commandeRows, accessToken);

    // ── 3. SAV ───────────────────────────────────────────────────────────────
    const { data: savRecords } = await supabase.from("sav").select("*").order("date", { ascending: false });
    const savRows: string[][] = [
      ["ID", "Numéro", "Nom du client", "Adresse", "Numéro de téléphone", "Problème", "Date", "Est résolu"],
      ...(savRecords || []).map((s: any) => [s.external_id || "", s.numero != null ? String(s.numero) : "", s.nom_client || "", s.adresse || "", s.telephone || "", s.probleme || "", fmtDate(s.date), s.est_resolu ? "TRUE" : "FALSE"]),
    ];
    await writeSheet(spreadsheetId, "SAV", savRows, accessToken);

    // ── 4. Affectations ──────────────────────────────────────────────────────
    const { data: assignments } = await supabase.from("assignments").select("*").order("start_date", { ascending: false });
    const assignmentRows: string[][] = [
      ["ID", "Equipe", "Chantier", "Date début", "Date fin", "Commentaire"],
      ...(assignments || []).map((a: any) => [a.id, a.team_id || "", a.commande_id || "", fmtDate(a.start_date), fmtDate(a.end_date), a.comment || ""]),
    ];
    await writeSheet(spreadsheetId, "Affectations", assignmentRows, accessToken);

    // ── 5. Absences ─────────────────────────────────────────────────────────
    const { data: absencesData } = await supabase.from("absences").select("*, motive:absence_motives(name)").order("start_date", { ascending: false });
    const absenceRows: string[][] = [
      ["ID", "Technicien", "Date début", "Date fin", "Motif", "Commentaire"],
      ...(absencesData || []).map((a: any) => [a.id, a.technician_id || "", fmtDate(a.start_date), fmtDate(a.end_date), a.motive_id || "", ""]),
    ];
    await writeSheet(spreadsheetId, "Absences", absenceRows, accessToken);

    // ── 6. Motifs ────────────────────────────────────────────────
    const { data: absenceMotives } = await supabase.from("absence_motives").select("*").order("name");
    const motiveRows: string[][] = [
      ["ID", "Nom", "Créé le"],
      ...(absenceMotives || []).map((m: any) => [m.id, m.name || "", fmtDate(m.created_at)]),
    ];
    await writeSheet(spreadsheetId, "Motifs", motiveRows, accessToken);

    // ── 7. Notes ─────────────────────────────────────────────────────────────
    const { data: notes } = await supabase.from("notes").select("*").order("start_date", { ascending: false });
    const noteRows: string[][] = [
      ["ID", "Equipe", "Date", "Texte", "Météo"],
      ...(notes || []).map((n: any) => [n.id, n.team_id || "", fmtDate(n.start_date), n.text || "", n.weather_condition || ""]),
    ];
    await writeSheet(spreadsheetId, "Notes", noteRows, accessToken);

    // ── 8. Véhicules ─────────────────────────────────────────────────────────
    const { data: vehicles } = await supabase.from("vehicles").select("*").order("name");
    const vehicleRows: string[][] = [
      ["ID", "Nom", "Immatriculation", "Statut", "Créé le"],
      ...(vehicles || []).map((v: any) => [v.id, v.name || "", v.license_plate || "", v.status || "", fmtDate(v.created_at)]),
    ];
    await writeSheet(spreadsheetId, "Véhicules", vehicleRows, accessToken);

    // ── 9. Matériel ─────────────────────────────────────────────────────────
    const { data: equipment } = await supabase.from("equipment").select("*").order("name");
    const equipmentRows: string[][] = [
      ["ID", "Nom", "Référence", "Statut", "Créé le"],
      ...(equipment || []).map((e: any) => [e.id, e.name || "", e.reference || "", e.status || "", fmtDate(e.created_at)]),
    ];
    await writeSheet(spreadsheetId, "Matériel", equipmentRows, accessToken);

    // ── 10. Matrice Compétences (DYNAMIC NEW TAB) ───────────────────────────
    const { data: skillsDict } = await supabase.from("skill_definitions").select("*").order("category").order("name");

    // Create the dynamic headers
    const skillHeaders = (skillsDict || []).map((s: any) => `${s.category} - ${s.name}`);
    const matriceRows: string[][] = [
      ["ID", "Nom d'usage", ...skillHeaders],
      ...(technicians || []).map((t: any) => {
        const row = [t.id, t.name || ""];
        const techSkills = t.detailed_skills || {};
        // Map the JSON data to the correct dynamic column
        skillHeaders.forEach(header => row.push(techSkills[header] || ""));
        return row;
      }),
    ];
    await writeSheet(spreadsheetId, "Matrice Compétences", matriceRows, accessToken);

    // Mark sync status as success
    if (syncRecord) {
      await supabase.from('sync_status').update({
        status: 'success',
        completed_at: new Date().toISOString(),
      }).eq('id', syncRecord.id);
    }

    return new Response(JSON.stringify({ message: "Exportation terminée avec succès" }), { headers: responseHeaders });
  } catch (error: any) {
    console.error("Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: responseHeaders, status: 500 });
  }
});