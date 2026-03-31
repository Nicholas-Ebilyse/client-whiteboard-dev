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
  console.log('Getting access token for:', credentials.client_email);
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
    console.log(`Created tab: ${sheetName}`);
  }

  if (rows.length === 0) {
    console.log(`No data to write to ${sheetName}`);
    return;
  }

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
  console.log(`Wrote ${rows.length - 1} data rows to ${sheetName}`);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-Edge-Version": "2026.03.13.2",
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401,
        headers: responseHeaders,
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: syncRecord, error: syncError } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'google_sheets_export',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncError) console.error('Failed to create sync record:', syncError);

    const isServiceRole = authHeader.includes(supabaseKey);
    let isAdmin = false;

    if (isServiceRole) {
      isAdmin = true;
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: responseHeaders });
      }

      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminCheck) isAdmin = true;
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès admin requis" }), { status: 403, headers: responseHeaders });
    }

    const body = await req.json().catch(() => ({}));
    let spreadsheetId = body.spreadsheetId;

    if (!spreadsheetId) {
      const { data: setting } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'google_spreadsheet_id')
        .maybeSingle();

      spreadsheetId = setting?.value || '1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY';
    }

    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: "spreadsheetId requis" }), { status: 400, headers: responseHeaders });
    }

    const googleKeySecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY_V2");
    if (!googleKeySecret) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_V2 not configured");
    const credentials = tryParseServiceAccountKey(googleKeySecret);
    const accessToken = await getAccessToken(credentials);

    // ── 1. Techniciens ───────────────────────────────────────────────────────
    const { data: technicians } = await supabase
      .from("technicians")
      .select("id, name, is_temp, created_at, is_accompanied, skills")
      .order("position");

    const techRows: string[][] = [
      ["ID", "Nom", "Interim", "Créé le", "Accompagné", "Compétences"],
      ...(technicians || []).map((t: any) => [
        t.id,
        t.name || "Sans nom",
        t.is_temp ? "TRUE" : "FALSE",
        fmtDate(t.created_at),
        t.is_accompanied ? "TRUE" : "FALSE",
        t.skills || "",
      ]),
    ];
    await writeSheet(spreadsheetId, "Techniciens", techRows, accessToken);

    // ── 2. Commandes ─────────────────────────────────────────────────────────
    const { data: commandes } = await supabase
      .from("commandes")
      .select("*, display_name")
      .order("numero", { ascending: false });

    const commandeRows: string[][] = [
      ["ID", "Numéro", "Nom client", "Chantier", "Nom court", "UUID", "Présence Client", "Type SAV"],
      ...(commandes || []).map((c: any) => [
        c.external_id || "",
        c.numero || "",
        c.client || "",
        c.chantier || "",
        c.display_name || "",
        c.id,
        c.client_presence || "",
        c.sav_type || "",
      ]),
    ];
    await writeSheet(spreadsheetId, "Commandes", commandeRows, accessToken);

    // ── 3. SAV ───────────────────────────────────────────────────────────────
    const { data: savRecords } = await supabase
      .from("sav")
      .select("*")
      .order("date", { ascending: false });

    const savRows: string[][] = [
      ["ID", "Numéro", "Nom du client", "Adresse", "Numéro de téléphone", "Problème", "Date", "Est résolu"],
      ...(savRecords || []).map((s: any) => [
        s.external_id || "",
        s.numero != null ? String(s.numero) : "",
        s.nom_client || "",
        s.adresse || "",
        s.telephone || "",
        s.probleme || "",
        fmtDate(s.date),
        s.est_resolu ? "TRUE" : "FALSE",
      ]),
    ];
    await writeSheet(spreadsheetId, "SAV", savRows, accessToken);

    // ── 4. Affectations ──────────────────────────────────────────────────────
    const { data: assignments } = await supabase
      .from("assignments")
      .select("*, commande_id")
      .order("start_date", { ascending: false });

    const assignmentRows: string[][] = [
      ["ID", "Equipe", "Chantier", "Date début", "Date fin", "Commentaire"],
      ...(assignments || []).map((a: any) => [
        a.id,
        a.team_id || "",
        a.commande_id || "",
        fmtDate(a.start_date),
        fmtDate(a.end_date),
        a.comment || "",
      ]),
    ];
    await writeSheet(spreadsheetId, "Affectations", assignmentRows, accessToken);

    // ── 5. Absences ─────────────────────────────────────────────────────────
    const { data: absencesData } = await supabase
      .from("absences")
      .select("*, motive:absence_motives(name)")
      .order("start_date", { ascending: false });

    const absenceRows: string[][] = [
      ["ID", "Technicien", "Date début", "Date fin", "Motif", "Commentaire"],
      ...(absencesData || []).map((a: any) => [
        a.id,
        a.technician_id || "",
        fmtDate(a.start_date),
        fmtDate(a.end_date),
        a.motive_id || "",
        "",
      ]),
    ];
    await writeSheet(spreadsheetId, "Absences", absenceRows, accessToken);

    // ── 6. Motifs ────────────────────────────────────────────────
    const { data: absenceMotives } = await supabase
      .from("absence_motives")
      .select("id, name, created_at")
      .order("name");

    const motiveRows: string[][] = [
      ["ID", "Nom", "Créé le"],
      ...(absenceMotives || []).map((m: any) => [
        m.id,
        m.name || "",
        fmtDate(m.created_at),
      ]),
    ];
    await writeSheet(spreadsheetId, "Motifs", motiveRows, accessToken);

    // ── 7. Notes ─────────────────────────────────────────────────────────────
    const { data: notes } = await supabase
      .from("notes")
      .select("*")
      .order("start_date", { ascending: false });

    const noteRows: string[][] = [
      ["ID", "Equipe", "Date", "Texte", "Météo"],
      ...(notes || []).map((n: any) => [
        n.id,
        n.team_id || "",
        fmtDate(n.start_date),
        n.text || "",
        n.weather_condition || "",
      ]),
    ];
    await writeSheet(spreadsheetId, "Notes", noteRows, accessToken);

    // ── 8. Véhicules ─────────────────────────────────────────────────────────
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("*")
      .order("name");

    const vehicleRows: string[][] = [
      ["ID", "Nom", "Immatriculation", "Statut", "Créé le"],
      ...(vehicles || []).map((v: any) => [
        v.id,
        v.name || "",
        v.license_plate || "",
        v.status || "",
        fmtDate(v.created_at),
      ]),
    ];
    await writeSheet(spreadsheetId, "Véhicules", vehicleRows, accessToken);

    // ── 9. Matériel ─────────────────────────────────────────────────────────
    const { data: equipment } = await supabase
      .from("equipment")
      .select("*")
      .order("name");

    const equipmentRows: string[][] = [
      ["ID", "Nom", "Référence", "Statut", "Créé le"],
      ...(equipment || []).map((e: any) => [
        e.id,
        e.name || "",
        e.reference || "",
        e.status || "",
        fmtDate(e.created_at),
      ]),
    ];
    await writeSheet(spreadsheetId, "Matériel", equipmentRows, accessToken);

    // Mark sync status as success
    const totalRecords = (technicians?.length || 0) + (commandes?.length || 0) + (savRecords?.length || 0) + (assignments?.length || 0) + (notes?.length || 0) + (absenceMotives?.length || 0) + (vehicles?.length || 0) + (equipment?.length || 0);

    if (syncRecord) {
      await supabase
        .from('sync_status')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          records_synced: totalRecords,
        })
        .eq('id', syncRecord.id);
    }

    return new Response(
      JSON.stringify({
        message: "Exportation terminée avec succès",
        counts: {
          techniciens: technicians?.length || 0,
          commandes: commandes?.length || 0,
          sav: savRecords?.length || 0,
          affectations: assignments?.length || 0,
          notes: notes?.length || 0,
          motifs: absenceMotives?.length || 0,
          vehicules: vehicles?.length || 0,
          materiel: equipment?.length || 0
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Critical error in export-to-sheets:", error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('sync_status')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: error.message,
          })
          .eq('sync_type', 'google_sheets_export')
          .eq('status', 'running')
          .order('started_at', { ascending: false })
          .limit(1);
      }
    } catch (e) {
      console.error('Failed to record export error:', e);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});