import { store, events, sleep, ok, done } from './env.js';
const sync = await import('../src/sync.js');
const sb = await import('../src/supabase.js');
const cloud = () => globalThis.__cloud;
const iso = (offsetMin) => new Date(Date.now() + offsetMin * 60000).toISOString();
const row = (key, value, at) => ({ user_id: 'user-1', key, value, updated_at: at });

// Windows has just written several things, stamped with its own (correct) clock.
cloud().rows = [
  row('kana_learned_words', [{ id: 1, text: 'Fatura kes' }], iso(-1)),
  row('flashCardGroups', { a: 1 }, iso(0)),
];
store.kana_learned_words = JSON.stringify([{ id: 1, text: 'Fatura kes' }]);
store.flashCardGroups = JSON.stringify({ a: 1 });
await sync.startupSync();
const rehydrated = [];
const stop = sync.startPolling((k) => rehydrated.push(k), 150);
await sleep(400);

console.log('\n--- the mac, whose clock runs an hour behind, adds a task ---');
const maxBefore = cloud().rows.map(r => r.updated_at).sort().pop();
const i = cloud().rows.findIndex(r => r.key === 'kana_learned_words');
cloud().rows[i] = row('kana_learned_words', [{ id: 1, text: 'Fatura kes' }, { id: 2, text: 'from the mac' }], iso(-60));
const maxAfter = cloud().rows.map(r => r.updated_at).sort().pop();
ok('(control) the newest stamp did not move — what the old check looked at', maxBefore === maxAfter);
await sleep(600);
ok('this machine noticed anyway', events.includes('kana_learned_words'));
ok('and shows the mac\'s task', JSON.parse(store.kana_learned_words).some(t => t.text === 'from the mac'));

console.log('\n--- status rows sit beside the data without becoming data ---');
cloud().rows.push(row('__learnstatus:mac123', { platform: 'mac', app: '4.9.2' }, iso(0)));
events.length = 0;
await sleep(600);
ok('a status row does not count as a change', events.length === 0);
const changed = await sb.pullFromSupabase();
ok('and is never written into localStorage', !Object.keys(store).some(k => k.startsWith('__learnstatus:')) && !changed.includes('__learnstatus:mac123'));
const statuses = await sb.readDeviceStatuses();
ok('but it can be read back', statuses.length === 1 && statuses[0].value.platform === 'mac');
stop();
done();
