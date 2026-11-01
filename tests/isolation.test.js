// Banko Learn shares the account and the user_data table with BankoSpace.
// It must read and write the study keys only: everything else on the account
// belongs to BankoSpace and is never touched from here.
import { store, sleep, ok, done } from './env.js';
const sync = await import('../src/sync.js');
const sb = await import('../src/supabase.js');
const cloud = () => globalThis.__cloud;
const at = () => new Date().toISOString();

cloud().rows = [
  { user_id: 'user-1', key: 'todos', value: [{ id: 1, text: 'BankoSpace task' }], updated_at: at() },
  { user_id: 'user-1', key: 'notes', value: [{ id: 1, content: 'BankoSpace note' }], updated_at: at() },
  { user_id: 'user-1', key: 'kana_stats', value: { streak: 3 }, updated_at: at() },
];
// Left on this device by an older copy, or typed by hand: still not ours.
store.todos = JSON.stringify([{ id: 9, text: 'stale' }]);

ok('startup pull succeeded', (await sync.startupSync()) === true);
ok('the study keys come down', JSON.parse(store.kana_stats).streak === 3);
ok('BankoSpace keys stay in the cloud only', store.notes === undefined);

localStorage.setItem('kana_stats', JSON.stringify({ streak: 4 }));
localStorage.setItem('todos', JSON.stringify([{ id: 1, text: 'overwritten?' }]));
localStorage.removeItem('notes');
await sb.pushDirtyToSupabase();
await sleep(1000);

const touched = cloud().calls
  .filter(c => c[0] === 'upsert' || c[0] === 'delete')
  .map(c => String(c[1]?.key ?? ''))
  .filter(k => !k.startsWith('__learnstatus:'));
ok('only study keys were ever written', touched.length > 0 && touched.every(k => sb.SYNC_KEYS.includes(k)));
ok('the study edit reached the cloud', cloud().rows.find(r => r.key === 'kana_stats').value.streak === 4);
ok('BankoSpace tasks are unchanged', cloud().rows.find(r => r.key === 'todos').value[0].text === 'BankoSpace task');
ok('BankoSpace notes are unchanged', cloud().rows.find(r => r.key === 'notes').value[0].content === 'BankoSpace note');
ok('only study keys are synced at all', sb.SYNC_KEYS.every(k => k.startsWith('kana_') || k.startsWith('flashCard')));
done();
