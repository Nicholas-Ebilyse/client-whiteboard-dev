const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseReal = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  const weekStart = '2026-03-23';
  const weekEnd = '2026-03-27';
  
  const { data, error } = await supabaseReal
    .from('assignments')
    .select('*, commandes(display_name)')
    .lte('start_date', weekEnd)
    .gte('end_date', weekStart);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} assignments in week 13`);
}
main();
