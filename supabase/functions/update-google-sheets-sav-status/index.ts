import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

async function fetchSheetData(spreadsheetId: string, sheetName: string, accessToken: string): Promise<any[][]> {
  const range = `${sheetName}!A:Z`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet data: ${await response.text()}`);
  }

  const data = await response.json();
  return data.values || [];
}

async function updateSheetCell(spreadsheetId: string, range: string, value: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[value]]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update sheet cell: ${await response.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.log('Invalid user token:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: adminCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminCheck) {
      console.log('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { savId, estResolu, spreadsheetId = '1hTdAy4pmhJQC6L7SJtRz_S2eQF_Lff4_7coUwouvDGI' } = await req.json();

    if (!savId) {
      return new Response(
        JSON.stringify({ error: 'Missing savId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} updating SAV status for ${savId} to ${estResolu}`);

    // Get the SAV record to find its external_id
    const { data: sav, error: fetchError } = await supabase
      .from('sav')
      .select('external_id')
      .eq('id', savId)
      .single();

    if (fetchError || !sav) {
      console.error('Failed to fetch SAV:', fetchError);
      return new Response(
        JSON.stringify({ error: 'SAV not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sav.external_id) {
      console.log('SAV has no external_id, skipping Google Sheets update');
      return new Response(
        JSON.stringify({ success: true, message: 'No external_id, skipping Google Sheets update' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google Sheets credentials
    const googleCredsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!googleCredsJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }

    const googleCreds: GoogleSheetsCredentials = JSON.parse(googleCredsJson);
    const accessToken = await getAccessToken(googleCreds);

    // Fetch sheet data to find the row and column
    const sheetData = await fetchSheetData(spreadsheetId, 'SAV', accessToken);
    
    if (sheetData.length === 0) {
      throw new Error('No data found in SAV sheet');
    }

    const headers = sheetData[0];
    
    // Find the ID column and "Est résolu" column
    const idIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('id'));
    const estResoluIndex = headers.findIndex((h: string) => 
      h?.toLowerCase().includes('est résolu') || 
      h?.toLowerCase().includes('est resolu') ||
      h?.toLowerCase() === 'est_resolu'
    );

    if (idIndex === -1) {
      throw new Error('ID column not found in sheet');
    }

    if (estResoluIndex === -1) {
      throw new Error('"Est résolu" column not found in sheet');
    }

    // Find the row with matching external_id
    let rowIndex = -1;
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (row[idIndex]?.toString().trim() === sav.external_id) {
        rowIndex = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.log(`Row with external_id ${sav.external_id} not found in sheet`);
      return new Response(
        JSON.stringify({ success: true, message: 'Row not found in Google Sheets' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert column index to letter (A, B, C, ..., Z, AA, AB, etc.)
    const getColumnLetter = (index: number): string => {
      let letter = '';
      while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    const columnLetter = getColumnLetter(estResoluIndex);
    const cellRange = `SAV!${columnLetter}${rowIndex}`;
    const newValue = estResolu ? 'TRUE' : 'FALSE';

    console.log(`Updating cell ${cellRange} to ${newValue}`);

    await updateSheetCell(spreadsheetId, cellRange, newValue, accessToken);

    console.log('Google Sheets SAV update successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated row ${rowIndex}, column ${columnLetter} to ${newValue}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error updating Google Sheets SAV:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});