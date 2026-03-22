import { createClient } from '@supabase/supabase-js';

const supabaseReal = createClient(
  'https://qldssnxbsigsdpcahszt.supabase.co',
  'sb_publishable_q5Jx30ru3hWJ4mYcbN3vyg_VrXiIlsn'
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
  console.log('Assignments count:', data.length);
  if (data.length > 0) {
    console.log(data[0]);
  }
}
main();
