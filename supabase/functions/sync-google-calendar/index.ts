import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default shared calendar ID
const DEFAULT_CALENDAR_ID = "c_aacbc90eaebcaf22d5a2f4f995ea620f4a896aca3e25266b0781b7abe2c1a792@group.calendar.google.com";

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

function tryParseServiceAccountKey(key: string): GoogleCredentials {
  const trimmed = key.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
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
    throw new Error(`Malformed Service Account Key extraction failed.`);
  }
}

interface Assignment {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  team_id: string;
  commande_id: string | null;
  is_confirmed: boolean | null;
  comment: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface Commande {
  id: string;
  client: string;
  chantier: string | null;
  display_name: string | null;
}

const CALENDAR_COLORS = {
  absent: "8",
  confirmed: "10",
  unconfirmed: "5",
  note: "9",
  sav: "4",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken(credentials: GoogleCredentials): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedClaim = btoa(JSON.stringify(jwtClaim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${jwtHeader}.${encodedClaim}`;

  const privateKey = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(credentials.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signatureInput));

  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const encodedSignature = btoa(sigBinary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signatureInput}.${encodedSignature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) throw new Error(`Google Auth failed: ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getEventColor(assignment: Assignment): string {
  if (assignment.is_confirmed) return CALENDAR_COLORS.confirmed;
  return CALENDAR_COLORS.unconfirmed;
}

function buildEventDescription(assignment: Assignment, commande: Commande | null, teamNames: string[]): string {
  const parts: string[] = [];
  if (teamNames.length > 0) parts.push(`Équipe(s): ${teamNames.join(", ")}`);
  parts.push(assignment.is_confirmed ? "Statut: Confirmé" : "Statut: Non confirmé");
  if (commande?.chantier) parts.push(`Adresse: ${commande.chantier}`);
  if (assignment.comment) parts.push(`Commentaire: ${assignment.comment}`);
  return parts.join("\n");
}

interface GroupedAssignment {
  key: string;
  assignments: Assignment[];
  teamIds: Set<string>;
  commande: Commande | null;
  date: string;
}

function groupAssignments(assignments: Assignment[], commandes: Map<string, Commande>): GroupedAssignment[] {
  const groups = new Map<string, GroupedAssignment>();

  for (const assignment of assignments) {
    const commande = assignment.commande_id ? commandes.get(assignment.commande_id) || null : null;
    const groupKey = `${assignment.commande_id || "no-commande"}_${assignment.start_date}_${assignment.end_date || assignment.start_date}`;

    if (groups.has(groupKey)) {
      const group = groups.get(groupKey)!;
      group.assignments.push(assignment);
      if (assignment.team_id) group.teamIds.add(assignment.team_id);
    } else {
      const tIds = new Set<string>();
      if (assignment.team_id) tIds.add(assignment.team_id);
      groups.set(groupKey, {
        key: groupKey,
        assignments: [assignment],
        teamIds: tIds,
        commande,
        date: assignment.start_date,
      });
    }
  }

  return Array.from(groups.values());
}

function buildGroupedCalendarEvent(group: GroupedAssignment, teamsMap: Map<string, Team>): any | null {
  const firstAssignment = group.assignments[0];
  const commande = group.commande;

  const teamNames: string[] = [];
  for (const tId of group.teamIds) {
    const team = teamsMap.get(tId);
    if (team && team.name) teamNames.push(team.name);
  }
  if (teamNames.length === 0) teamNames.push("Équipe Inconnue");

  let title = commande?.display_name || commande?.client || firstAssignment.name || "Affectation";
  const colorId = getEventColor(firstAssignment);
  const location = commande?.chantier || "";

  // ── FIX: Timed events so they are visible in the grid (8am - 5pm) ──
  const startDateTime = `${group.date}T08:00:00Z`;
  const endDateTime = `${firstAssignment.end_date || group.date}T17:00:00Z`;

  return {
    summary: title,
    description: buildEventDescription(firstAssignment, commande, teamNames),
    location,
    start: { dateTime: startDateTime, timeZone: 'Europe/Paris' },
    end: { dateTime: endDateTime, timeZone: 'Europe/Paris' },
    colorId,
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        source: "lovable-planning",
        assignmentIds: group.assignments.map((a) => a.id).join(","),
        customKey: `group_${group.key}`,
      },
    },
  };
}

function cleanString(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/\r/g, "").trim();
}

function extractLocalTime(isoString: string | undefined | null): string {
  if (!isoString) return "";
  const match = isoString.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : isoString;
}

function eventsAreIdentical(existing: any, target: any): boolean {
  if (cleanString(existing.summary) !== cleanString(target.summary)) return false;
  if (cleanString(existing.description) !== cleanString(target.description)) return false;
  if (cleanString(existing.location) !== cleanString(target.location)) return false;

  const eStart = existing.start?.date || extractLocalTime(existing.start?.dateTime);
  const tStart = target.start?.date || extractLocalTime(target.start?.dateTime);
  if (eStart !== tStart) return false;

  const eEnd = existing.end?.date || extractLocalTime(existing.end?.dateTime);
  const tEnd = target.end?.date || extractLocalTime(target.end?.dateTime);
  if (eEnd !== tEnd) return false;

  if (existing.colorId !== target.colorId) return false;
  return true;
}

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    const response = await fetch(url, options);
    if (response.status === 429 || response.status === 403) {
      attempt++;
      await delay(Math.pow(2, attempt) * 1000);
      continue;
    }
    return response;
  }
  throw new Error(`Max retries reached for ${url}`);
}

async function fetchAllExistingEvents(calendarId: string, accessToken: string, syncStart: string, syncEnd: string) {
  let allEvents: any[] = [];
  let pageToken: string | null = null;
  const timeMin = new Date(syncStart);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(syncEnd);
  timeMax.setDate(timeMax.getDate() + 1);

  do {
    let listUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=source%3Dlovable-planning&timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&maxResults=2500`;
    if (pageToken) listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const response = await fetchWithRetry(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) break;

    const data = await response.json();
    if (data.items) allEvents = allEvents.concat(data.items);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allEvents;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const responseHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'X-Edge-Version': '2026.04.05.FINAL_CALENDAR' };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Auth requise");

    // Get Credentials
    const googleKeySecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY_V2");
    if (!googleKeySecret) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_V2 not configured");
    const credentials = tryParseServiceAccountKey(googleKeySecret);
    const accessToken = await getAccessToken(credentials);

    const body = await req.json().catch(() => ({}));
    let calendarId = body.calendarId;
    if (!calendarId) {
      const { data: setting } = await supabase.from('global_settings').select('value').eq('key', 'google_calendar_id').maybeSingle();
      calendarId = setting?.value || DEFAULT_CALENDAR_ID;
    }

    // Diagnostics
    console.log(`=== SYNC START: Calendar ${calendarId} ===`);

    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const syncStart = startOfCurrentWeek.toISOString().split("T")[0];
    const endDate = new Date(startOfCurrentWeek);
    endDate.setDate(endDate.getDate() + 5 * 7); // Sync 5 weeks
    const syncEnd = endDate.toISOString().split("T")[0];

    // Database Queries
    const [assignmentsRes, teamsRes, commandesRes] = await Promise.all([
      supabase.from("assignments").select("*").gte("start_date", syncStart).lte("start_date", syncEnd),
      supabase.from("teams").select("id, name"),
      supabase.from("commandes").select("id, client, chantier, display_name"),
    ]);

    const assignments: Assignment[] = assignmentsRes.data || [];
    const teamsMap = new Map<string, Team>((teamsRes.data || []).map((t: Team) => [t.id, t]));
    const commandesMap = new Map<string, Commande>((commandesRes.data || []).map((c: Commande) => [c.id, c]));

    console.log(`Found ${assignments.length} assignments in range ${syncStart} to ${syncEnd}`);

    const groupedAssignments = groupAssignments(assignments, commandesMap);
    const targetEvents = new Map<string, any>();

    groupedAssignments.forEach(group => {
      const event = buildGroupedCalendarEvent(group, teamsMap);
      if (event) targetEvents.set(event.extendedProperties.private.customKey, event);
    });

    const existingEvents = await fetchAllExistingEvents(calendarId, accessToken, syncStart, syncEnd);
    console.log(`Found ${existingEvents.length} existing planning events in Calendar.`);

    const toDelete: any[] = [];
    const toCreate: any[] = [];
    const toUpdate: { id: string, event: any }[] = [];

    existingEvents.forEach(existing => {
      const customKey = existing.extendedProperties?.private?.customKey;
      if (!customKey) return;
      if (targetEvents.has(customKey)) {
        const target = targetEvents.get(customKey);
        if (!eventsAreIdentical(existing, target)) toUpdate.push({ id: existing.id, event: target });
        targetEvents.delete(customKey);
      } else {
        toDelete.push(existing);
      }
    });

    targetEvents.forEach(target => toCreate.push(target));

    // Execute Batches
    const BATCH_SIZE = 10;
    for (const event of toDelete) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    }
    for (const item of toUpdate) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${item.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(item.event) });
    }
    for (const event of toCreate) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
    }

    console.log(`Summary: Created ${toCreate.length}, Updated ${toUpdate.length}, Deleted ${toDelete.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Synchronisation réussie. Créés: ${toCreate.length}, Mis à jour: ${toUpdate.length}, Supprimés: ${toDelete.length}`,
      counts: { created: toCreate.length, updated: toUpdate.length, deleted: toDelete.length }
    }), { status: 200, headers: responseHeaders });

  } catch (error: any) {
    console.error("Critical Sync Failure:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: responseHeaders });
  }
});