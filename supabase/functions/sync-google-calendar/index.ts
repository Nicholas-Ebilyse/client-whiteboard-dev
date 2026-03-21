import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default to the shared group calendar
const DEFAULT_CALENDAR_ID =
  "c_8ca18ced58f50f7a5d670b6bee03ca40017d805860177daba7efcd7a6a53b8b2@group.calendar.google.com";

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

function tryParseServiceAccountKey(key: string): GoogleCredentials {
  const trimmed = key.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    console.error("Direct JSON.parse failed for calendar key, trying robust extraction:", (err as any).message);

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

interface Assignment {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  team_id: string;
  commande_id: string | null;
  is_absent: boolean | null;
  is_confirmed: boolean | null;
  comment: string | null;
  absence_reason: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface Commande {
  id: string;
  client: string;
  chantier: string;
}

interface Note {
  id: string;
  text: string;
  technician_id: string | null;
  start_date: string;
  end_date: string | null;
  start_period: string;
  end_period: string;
  is_sav: boolean;
}

// French public holidays for 2024-2026
const FRENCH_HOLIDAYS: Set<string> = new Set([
  // 2024
  "2024-01-01",
  "2024-04-01",
  "2024-05-01",
  "2024-05-08",
  "2024-05-09",
  "2024-05-20",
  "2024-07-14",
  "2024-08-15",
  "2024-11-01",
  "2024-11-11",
  "2024-12-25",
  // 2025
  "2025-01-01",
  "2025-04-21",
  "2025-05-01",
  "2025-05-08",
  "2025-05-29",
  "2025-06-09",
  "2025-07-14",
  "2025-08-15",
  "2025-11-01",
  "2025-11-11",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-04-06",
  "2026-05-01",
  "2026-05-08",
  "2026-05-14",
  "2026-05-25",
  "2026-07-14",
  "2026-08-15",
  "2026-11-01",
  "2026-11-11",
  "2026-12-25",
]);

// Google Calendar color IDs (limited palette)
const CALENDAR_COLORS = {
  absent: "8", // Graphite for absence
  confirmed: "10", // Basil/Green for confirmed
  unconfirmed: "5", // Banana/Yellow for not confirmed
  note: "9", // Blueberry for notes
  sav: "4", // Flamingo/Pink for SAV notes
};

// Rate limiting helper - wait between API calls
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function isHoliday(dateStr: string): boolean {
  return FRENCH_HOLIDAYS.has(dateStr);
}

function shouldSkipDate(dateStr: string): boolean {
  return isWeekend(dateStr) || isHoliday(dateStr);
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

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signatureInput));

  // Use loop to avoid RangeError on large signatures
  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.length; i++) sigBinary += String.fromCharCode(sigBytes[i]);
  const encodedSignature = btoa(sigBinary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${encodedSignature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


function getEventColor(assignment: Assignment, commande: Commande | null): string {
  if (assignment.is_absent) return CALENDAR_COLORS.absent;
  if (assignment.is_confirmed) return CALENDAR_COLORS.confirmed;
  return CALENDAR_COLORS.unconfirmed;
}

function buildEventDescription(assignment: Assignment, commande: Commande | null, teamNames: string[]): string {
  const parts: string[] = [];

  // Add team names at the top
  if (teamNames.length > 0) {
    parts.push(`Équipe(s): ${teamNames.join(", ")}`);
  }

  if (assignment.is_absent) {
    parts.push("Statut: Absence");
    if (assignment.absence_reason) {
      parts.push(`Raison: ${assignment.absence_reason}`);
    }
    if (assignment.comment) {
      parts.push(`Commentaire: ${assignment.comment}`);
    }
  } else {
    if (assignment.is_confirmed) {
      parts.push("Statut: Confirmé");
    } else {
      parts.push("Statut: Non confirmé");
    }
    if (assignment.comment) {
      parts.push(`Commentaire: ${assignment.comment}`);
    }
  }

  return parts.join("\n");
}

// Group assignments by chantier and date to consolidate duplicates
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
    // Skip weekends and holidays
    if (shouldSkipDate(assignment.start_date)) {
      continue;
    }

    const commande = assignment.commande_id ? commandes.get(assignment.commande_id) || null : null;

    // Create a key based on chantier (or absence) and date
    // For absences, we don't group - each absence is separate
    const groupKey = assignment.is_absent
      ? `absent_${assignment.id}` // Unique key for absences
      : `${assignment.commande_id || "no-commande"}_${assignment.start_date}_${assignment.end_date}`;

    if (groups.has(groupKey)) {
      const group = groups.get(groupKey)!;
      group.assignments.push(assignment);
      group.teamIds.add(assignment.team_id);
    } else {
      const tIds = new Set<string>([assignment.team_id]);
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

function buildGroupedCalendarEvent(
  group: GroupedAssignment,
  teams: Map<string, Team>,
): any | null {
  const firstAssignment = group.assignments[0];
  const commande = group.commande;

  // Build team names list
  const teamNames: string[] = [];
  for (const tId of group.teamIds) {
    const team = teams.get(tId);
    if (team) {
      teamNames.push(team.name);
    }
  }

  if (teamNames.length === 0) {
    return null;
  }

  // Build event title
  let title: string;
  if (firstAssignment.is_absent) {
    const tm = teams.get(firstAssignment.team_id);
    title = `Absent - ${tm?.name || "Inconnu"}`;
    if (firstAssignment.absence_reason) {
      title += ` (${firstAssignment.absence_reason})`;
    } else if (firstAssignment.comment) {
      title += ` (${firstAssignment.comment})`;
    }
  } else if (commande) {
    title = commande.client;
  } else {
    title = firstAssignment.name || "Sans titre";
  }

  // Determine color
  const colorId = getEventColor(firstAssignment, commande);

  // Build location
  const location = commande?.chantier || "";

  // Full day event requires end date to be exclusive in Google Calendar
  const startDate = new Date(group.date);
  const endDate = new Date(firstAssignment.end_date || group.date);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  return {
    summary: title,
    description: buildEventDescription(firstAssignment, commande, teamNames),
    location,
    start: {
      date: group.date,
    },
    end: {
      date: endDateStr,
    },
    colorId,
    reminders: {
      useDefault: false,
      overrides: [],
    },
    extendedProperties: {
      private: {
        source: "lovable-planning",
        assignmentIds: group.assignments.map((a) => a.id).join(","),
        customKey: `group_${group.key}`,
      },
    },
  };
}

// remove buildNoteCalendarEvent since we are excluding notes

function cleanString(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/\r/g, "").trim();
}

function extractLocalTime(isoString: string | undefined | null): string {
  if (!isoString) return "";
  // Google returns "2024-03-25T08:00:00+01:00"
  // We send "2024-03-25T08:00:00"
  // This extracts just the inner local time block for safe string comparison
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

  const existingIdStr = existing.extendedProperties?.private?.assignmentIds || "";
  const targetIdStr = target.extendedProperties?.private?.assignmentIds || "";
  if (existingIdStr !== targetIdStr) return false;

  return true;
}

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    const response = await fetch(url, options);

    // If rate limited or quota exceeded, wait and retry
    if (response.status === 429 || response.status === 403) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`Exceeded max retries for ${url}. Status: ${response.status}`);
      }
      // Exponential backoff: 1s, 2s, 4s...
      const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.log(`Rate limited (${response.status}). Retrying in ${Math.round(backoffTime)}ms...`);
      await delay(backoffTime);
      continue;
    }

    return response;
  }
  throw new Error(`Unreachable fetch fallback`);
}

async function fetchAllExistingEvents(calendarId: string, accessToken: string, syncStart: string, syncEnd: string) {
  let allEvents: any[] = [];
  let pageToken: string | null = null;

  // Pad the window slightly to ensure we catch edge cases
  const timeMin = new Date(syncStart);
  timeMin.setDate(timeMin.getDate() - 1);
  const timeMax = new Date(syncEnd);
  timeMax.setDate(timeMax.getDate() + 2); // syncEnd + 1 day, then +1 to be safe

  do {
    let listUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=source%3Dlovable-planning&timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&maxResults=2500`;
    if (pageToken) {
      listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await fetchWithRetry(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.log("Failed to list events (may be first sync):", await response.text());
      break;
    }

    const data = await response.json();
    if (data.items) {
      allEvents = allEvents.concat(data.items);
    }
    pageToken = data.nextPageToken || null;

    if (pageToken) await delay(200);
  } while (pageToken);

  return allEvents;
}

async function updateSyncStatus(
  supabase: any,
  status: "running" | "success" | "error",
  recordsSynced: number = 0,
  errorMessage: string | null = null,
): Promise<string | null> {
  try {
    if (status === "running") {
      const { data, error } = await supabase
        .from("sync_status")
        .insert({
          sync_type: "google_calendar",
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return data?.id || null;
    } else {
      // Update the latest running status
      const { error } = await supabase
        .from("sync_status")
        .update({
          status,
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
          error_message: errorMessage,
        })
        .eq("sync_type", "google_calendar")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1);

      if (error) console.error("Failed to update sync status:", error);
    }
  } catch (err) {
    console.error("Sync status update failed:", err);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'X-Edge-Version': '2026.03.13.1'
  };

  try {
    // Authenticate user via JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    let userId = 'system-cron';
    console.log('Verifying permissions...');
    const isServiceRole = authHeader.includes(supabaseKey);
    let isAdmin = false;

    if (isServiceRole) {
      console.log('Authorized via service_role key');
      isAdmin = true;
    } else {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        console.error("Calendar sync auth error:", userError);
        return new Response(JSON.stringify({ error: "Session invalide" }), {
          status: 401,
          headers: responseHeaders,
        });
      }

      userId = user.id;
      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminCheck) {
        isAdmin = true;
        console.log('Admin verified:', user.email);
      }
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required for sync operations" }), {
        status: 403,
        headers: responseHeaders,
      });
    }

    // Get the google service account key
    const googleKeySecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!googleKeySecret) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    }
    const credentials = tryParseServiceAccountKey(googleKeySecret);
    const accessToken = await getAccessToken(credentials);

    console.log(`Google Calendar sync initiated by: ${userId}`);

    // Use the group calendar by default (no domain-wide delegation needed)
    const body = await req.json().catch(() => ({}));
    let calendarId = body.calendarId;

    if (!calendarId) {
      console.log('No calendarId in request, checking global_settings...');
      const { data: setting } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .maybeSingle();
      
      calendarId = setting?.value || DEFAULT_CALENDAR_ID;
    }

    const clearOnly = body.clearOnly || false;

    console.log(`Starting Google Calendar sync for: ${calendarId} (clearOnly: ${clearOnly})`);

    // Record sync start
    await updateSyncStatus(supabase, "running");

    if (clearOnly) {
      console.log("Clear-only mode: Not supported with delta sync directly yet, but skipping for now.");
      await updateSyncStatus(supabase, "success", 0);
      return new Response(
        JSON.stringify({ success: true, message: "Clear-only mode triggered (noop)", eventsCreated: 0, notesCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Fetching data from database...");

    // Only sync current week and 4 weeks ahead to avoid timeout
    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const syncStart = startOfCurrentWeek.toISOString().split("T")[0];
    const endDate = new Date(startOfCurrentWeek);
    endDate.setDate(endDate.getDate() + 5 * 7); // 5 weeks ahead
    const syncEnd = endDate.toISOString().split("T")[0];

    console.log(`Syncing date range: ${syncStart} to ${syncEnd}`);

    const [assignmentsResult, teamsResult, commandesResult] = await Promise.all([
      supabase.from("assignments").select("*").gte("start_date", syncStart).lte("start_date", syncEnd),
      supabase.from("teams").select("id, name"),
      supabase.from("commandes").select("id, client, chantier"),
    ]);

    if (assignmentsResult.error) throw assignmentsResult.error;
    if (teamsResult.error) throw teamsResult.error;
    if (commandesResult.error) throw commandesResult.error;

    const assignments: Assignment[] = assignmentsResult.data || [];
    const teams = new Map<string, Team>((teamsResult.data || []).map((t: Team) => [t.id, t]));
    const commandes = new Map<string, Commande>((commandesResult.data || []).map((c: Commande) => [c.id, c]));

    console.log(`Found ${assignments.length} assignments for calendar sync`);

    // Group assignments to consolidate duplicates and filter weekends/holidays
    const groupedAssignments = groupAssignments(assignments, commandes);
    console.log(`Grouped into ${groupedAssignments.length} unique events (after filtering weekends/holidays)`);

    // Generate target events
    const targetEvents = new Map<string, any>();

    groupedAssignments.forEach(group => {
      const event = buildGroupedCalendarEvent(group, teams);
      if (event) targetEvents.set(event.extendedProperties.private.customKey, event);
    });

    // Notes are now excluded from calendar sync
    console.log(`Generated ${targetEvents.size} target events (assignments only). Fetching existing events...`);

    // Fetch existing events in the sync window
    const existingEvents = await fetchAllExistingEvents(calendarId, accessToken, syncStart, syncEnd);
    console.log(`Found ${existingEvents.length} existing events in calendar.`);

    const toDelete: any[] = [];
    const toCreate: any[] = [];
    const toUpdate: { id: string, event: any }[] = [];

    existingEvents.forEach(existing => {
      const customKey = existing.extendedProperties?.private?.customKey;

      if (!customKey) {
        // If it was created by lovable-planning but lacks customKey (old format), delete it
        toDelete.push(existing);
        return;
      }

      if (targetEvents.has(customKey)) {
        const target = targetEvents.get(customKey);
        if (!eventsAreIdentical(existing, target)) {
          toUpdate.push({ id: existing.id, event: target });
        }
        // Remove from targetEvents so we know it's handled
        targetEvents.delete(customKey);
      } else {
        // Exists in calendar but not in target -> delete
        toDelete.push(existing);
      }
    });

    // Remaining targetEvents need to be created
    targetEvents.forEach(target => {
      toCreate.push(target);
    });

    console.log(`Delta: ${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`);

    const BATCH_SIZE = 10; // Reduced for safety against burst limits

    // Execute Deletes
    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} events...`);
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(event => fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })));
        await delay(300);
      }
    }

    // Execute Updates
    if (toUpdate.length > 0) {
      console.log(`Updating ${toUpdate.length} events...`);
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item => fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${item.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(item.event) })));
        await delay(300);
      }
    }

    // Execute Creates
    if (toCreate.length > 0) {
      console.log(`Creating ${toCreate.length} events...`);
      for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
        const batch = toCreate.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(event => fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) })));
        await delay(300);
      }
    }

    console.log(`Sync complete.`);

    // Update sync status to success
    await updateSyncStatus(supabase, "success", toCreate.length + toUpdate.length + groupedAssignments.length); // arbitrary count for UI to show activity

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronized successfully. Created: ${toCreate.length}, Updated: ${toUpdate.length}, Deleted: ${toDelete.length}`,
        eventsCreated: toCreate.length,
        eventsUpdated: toUpdate.length,
        eventsDeleted: toDelete.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error syncing to Google Calendar:", error);

    // Update sync status to error
    await updateSyncStatus(supabase, "error", 0, error.message);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
