import { createClient } from '@supabase/supabase-js';
const supabaseReal = createClient(
  'https://qldssnxbsigsdpcahszt.supabase.co',
  'sb_publishable_q5Jx30ru3hWJ4mYcbN3vyg_VrXiIlsn'
);
async function main() {
  const testNote = {
    start_date: '2026-03-24',
    end_date: '2026-03-24',
    text: 'Test note from debug script',
    is_sav: false,
    display_below: false,
  };

  const { data: teams } = await supabaseReal.from('teams').select('id').limit(1);
  if (teams && teams.length > 0) {
    testNote.team_id = teams[0].id;
  }

  console.log('Attempting to insert:', testNote);
  const res = await supabaseReal.from('notes').insert(testNote);
  console.log('Response:', res);
}
main();
