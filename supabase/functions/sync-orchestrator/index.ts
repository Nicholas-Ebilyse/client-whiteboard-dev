import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Sync Orchestrator started...');

    // 1. Fetch settings
    const { data: settings } = await supabase
      .from('global_settings')
      .select('key, value');

    const spreadsheetId = settings?.find(s => s.key === 'google_spreadsheet_id')?.value;
    const calendarId = settings?.find(s => s.key === 'google_calendar_id')?.value;

    if (!spreadsheetId) {
      console.warn('No spreadsheetId found in global_settings. Skipping Sheets sync.');
    }

    const results: any = {};

    // 2. Import from Sheets
    if (spreadsheetId) {
      console.log('Step 1: Importing from Sheets...');
      const importRes = await fetch(`${supabaseUrl}/functions/v1/sync-google-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
      });
      results.import = await importRes.json();
      console.log('Import finished:', results.import);
    }

    // 3. Sync to Calendar
    console.log('Step 2: Syncing to Calendar...');
    const calendarRes = await fetch(`${supabaseUrl}/functions/v1/sync-google-calendar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ calendarId }),
    });
    results.calendar = await calendarRes.json();
    console.log('Calendar sync finished:', results.calendar);

    // 4. Export to Sheets
    if (spreadsheetId) {
      console.log('Step 3: Exporting to Sheets...');
      const exportRes = await fetch(`${supabaseUrl}/functions/v1/export-to-sheets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
      });
      results.export = await exportRes.json();
      console.log('Export finished:', results.export);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
