import { store, sessionData, sleep, ok, done } from './env.js';

console.log('\n--- (control) the old way of wrapping, under WebKit rules ---');
let called = 0;
localStorage.setItem = function () { called++; };          // what 4.9.3 and earlier did
localStorage.setItem('probe', 'x');
ok('the wrapper is never called', called === 0);
ok('instead an item named "setItem" was stored', typeof store.setItem === 'string');
ok('and the write still went through untouched', store.probe === 'x');
delete store.setItem; delete store.probe;
// leave junk like the Mac has, to check it is cleaned up
store.setItem = 'function (key, value) { /* old wrapper */ }';
store.removeItem = '(key) => { }';

const sync = await import('../src/sync.js');
const sb = await import('../src/supabase.js');
const cloud = () => globalThis.__cloud;
const cloudVal = (k) => cloud().rows.find(r => r.key === k)?.value;
cloud().rows = [{ user_id: 'user-1', key: 'kana_learned_words', value: [{ id: 1, text: 'Fatura kes' }], updated_at: new Date().toISOString() }];
store.kana_learned_words = JSON.stringify([{ id: 1, text: 'Fatura kes' }]);

console.log('\n--- the new wrapping, same WebKit rules ---');
ok('startup', (await sync.startupSync()) === true);
ok('the junk items the old wrapper left are gone', !('setItem' in store) && !('removeItem' in store));
localStorage.setItem('kana_learned_words', JSON.stringify([{ id: 1, text: 'Fatura kes' }, { id: 2, text: 'typed on the mac' }]));
ok('the edit is caught and marked', sb.readDirtyKeys().has('kana_learned_words'));
await sleep(1000);
ok('and reaches the cloud', cloudVal('kana_learned_words').some(t => t.text === 'typed on the mac'));
ok('push health recorded', !!sb.syncHealth.lastPushOk);
ok('mark cleared once it landed', !sb.readDirtyKeys().has('kana_learned_words'));

console.log('\n--- removal, and storage that is not localStorage ---');
localStorage.setItem('kana_stats', JSON.stringify(['a']));
await sleep(900);
localStorage.removeItem('kana_stats');
await sleep(300);
ok('a removal reaches the cloud as a durable tombstone', cloudVal('kana_stats') === 'null');
const before = cloud().calls.length;
sessionStorage.setItem('kana_learned_words', 'session only');
sessionStorage.removeItem('kana_learned_words');
await sleep(900);
ok('sessionStorage writes are not synced', cloud().calls.length === before);
ok('and still work', sessionData.todos === undefined);

console.log('\n--- emptying the device leaves the cloud alone ---');
const { clearAccountData } = await import('../src/utils/accounts.js');
const n = cloud().rows.length;
const d0 = cloud().calls.filter(c => c[0] === 'delete').length;
globalThis.__diag = () => {};
await clearAccountData().catch(() => {});
ok('no deletes', cloud().calls.filter(c => c[0] === 'delete').length === d0 && cloud().rows.length === n);
ok('device empty', localStorage.getItem('kana_learned_words') === null);
done();
