import { useState, useEffect, useCallback } from 'react';
import { isTauri, windowControls, startWindowDrag } from './platform';
import logo from './assets/logo.svg';
import './App.css';
import './Learn.css';
import { supabase, pushDirtyToSupabase } from './supabase';
import { startupSync, settleAfterMount, startPolling, flushAll, cancelPending } from './sync';
import Login from './components/Login';
import JapaneseKana from './components/JapaneseKana';
import { displayName, accountSubtitle, avatarColor, initials, getProfile } from './utils/profile';
import { forgetAccount, rememberAccount, clearAccountData } from './utils/accounts';
import { claimLegacyApiKey, forgetApiKey } from './utils/apiKey';

const APP_VERSION = '1.0.0';
window.__APP_VERSION = APP_VERSION;

// Banko Learn: the Japanese study section of BankoSpace as an app of its own.
// It signs in to the same account and syncs only the study keys (see
// SYNC_KEYS in supabase.js), so progress made in either place is the same
// progress, and nothing else on the account is touched.
const PAGES = [
  { id: 'guide', label: 'Guide', glyph: 'あ', hint: 'Every kana, how it sounds and how to write it' },
  { id: 'practice', label: 'Practice', glyph: '練', hint: 'Drill the rows you pick' },
  { id: 'vocabulary', label: 'Vocabulary', glyph: '語', hint: 'Words to learn, in folders' },
  { id: 'flashcards', label: 'Flash Cards', glyph: '札', hint: 'Your decks, with review' },
];
const VIEW_KEY = 'kana_ui_view';

function App({ session }) {
  const [platform, setPlatform] = useState('windows');
  useEffect(() => {
    if (!isTauri) return;
    import('@tauri-apps/plugin-os').then(({ platform: p }) => {
      try { setPlatform(p() === 'macos' ? 'macos' : 'windows'); } catch { /* keep the default */ }
    });
  }, []);

  const [view, setView] = useState(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    return PAGES.some(p => p.id === saved) ? saved : 'guide';
  });
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  // Ctrl/Cmd+1…4 moves between the pages.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < PAGES.length) { e.preventDefault(); setView(PAGES[i].id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Changes from BankoSpace or another machine arrive through the sync layer;
  // the study pages re-read storage themselves, so there is nothing held here
  // to refresh.
  useEffect(() => startPolling(() => {}), []);

  // Hold a native close until queued writes are sent (with a time limit).
  useEffect(() => {
    window.__flushPendingPushes = flushAll;
    window.__cancelPendingPushes = cancelPending;
    let unlisten = null;
    let disposed = false;
    if (isTauri) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        if (disposed) return;
        const w = getCurrentWindow();
        w.onCloseRequested(async (event) => {
          event.preventDefault();
          await Promise.race([Promise.all(flushAll()), new Promise(r => setTimeout(r, 4000))]);
          await w.destroy();
        }).then(fn => { unlisten = fn; });
      });
    }
    return () => {
      disposed = true;
      if (unlisten) unlisten();
      delete window.__cancelPendingPushes;
      delete window.__flushPendingPushes;
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) claimLegacyApiKey(session.user.id);
    if (session) rememberAccount(session, getProfile());
  }, [session]);

  // Updates: checked quietly a few seconds after opening; installed only when
  // asked.
  const [update, setUpdate] = useState(null);
  const [updating, setUpdating] = useState('idle'); // idle | downloading | error
  useEffect(() => {
    if (!isTauri) return;
    const t = setTimeout(() => {
      import('@tauri-apps/plugin-updater').then(({ check }) => check()).then(u => {
        if (u?.available) setUpdate(u);
      }).catch(err => { if (window.__diag) window.__diag(`update-check: ERROR ${err?.message || err}`, true); });
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  const installUpdate = useCallback(async () => {
    if (!update) return;
    setUpdating('downloading');
    try {
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setUpdating('error');
    }
  }, [update]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await Promise.all(flushAll());
      await pushDirtyToSupabase();
    } catch { /* sent on the next sign-in otherwise */ }
    window.__cancelPendingPushes?.();
    const id = session?.user?.id;
    // Only this device's copy goes; the cloud keeps everything.
    await clearAccountData();
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* cleared either way */ }
    if (id) { forgetAccount(id); forgetApiKey(id); }
    window.location.reload();
  };

  const name = displayName(session);
  const page = PAGES.find(p => p.id === view);

  return (
    <div className={`learn-app learn-${platform}`}>
      <div className="learn-titlebar">
        {isTauri && platform === 'macos' && (
          <div className="learn-traffic">
            <button className="traffic-light close" onClick={windowControls.close} title="Close" />
            <button className="traffic-light minimize" onClick={windowControls.minimize} title="Minimize" />
            <button className="traffic-light maximize" onClick={windowControls.maximize} title="Maximize" />
          </div>
        )}
        <div className="learn-drag" onMouseDown={startWindowDrag} onDoubleClick={windowControls.maximize} />
        {isTauri && platform === 'windows' && (
          <div className="learn-winctl">
            <button onClick={windowControls.minimize} title="Minimize">
              <svg width="11" height="11" viewBox="0 0 11 11"><rect y="5" width="11" height="1.2" fill="currentColor" /></svg>
            </button>
            <button onClick={windowControls.maximize} title="Maximize">
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
            </button>
            <button className="close" onClick={windowControls.close} title="Close">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M.6.6l8.8 8.8M9.4.6L.6 9.4" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className="learn-body">
        <aside className="learn-sidebar">
          <div className="learn-brand">
            <img src={logo} alt="" />
            <span>Banko Learn</span>
          </div>

          <nav className="learn-nav">
            {PAGES.map((p, i) => (
              <button
                key={p.id}
                className={`learn-nav-item${view === p.id ? ' active' : ''}`}
                onClick={() => setView(p.id)}
                title={p.hint}
              >
                <span className="learn-nav-glyph" lang="ja">{p.glyph}</span>
                <span className="learn-nav-label">{p.label}</span>
                <span className="learn-nav-key">{platform === 'macos' ? '⌘' : 'Ctrl '}{i + 1}</span>
              </button>
            ))}
          </nav>

          <div className="learn-foot">
            {update && (
              <button className="learn-update" onClick={installUpdate} disabled={updating === 'downloading'}>
                {updating === 'downloading' ? 'Updating…'
                  : updating === 'error' ? 'Update failed — try again'
                  : `Update to ${update.version}`}
              </button>
            )}
            <div className="learn-account">
              <button className="learn-account-btn" onClick={() => setMenuOpen(o => !o)}>
                <span className="learn-avatar" style={{ background: avatarColor(getProfile(), name) }}>{initials(name)}</span>
                <span className="learn-account-text">
                  <span className="learn-account-name">{name}</span>
                  <span className="learn-account-mail">{accountSubtitle(session?.user?.email)}</span>
                </span>
              </button>
              {menuOpen && (
                <div className="learn-account-menu">
                  <p>Signed in with your BankoSpace account. Your study progress is shared with BankoSpace and your other devices.</p>
                  <button onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
                </div>
              )}
            </div>
            <div className="learn-version">v{APP_VERSION}</div>
          </div>
        </aside>

        <main className="learn-main">
          <header className="learn-page-head">
            <h1>{page.label}</h1>
            <p>{page.hint}</p>
          </header>
          <div className="learn-page">
            <JapaneseKana view={view} />
          </div>
        </main>
      </div>
    </div>
  );
}

function AppWrapper() {
  // undefined = not checked yet, null = signed out
  const [session, setSession] = useState(undefined);
  const [syncedFor, setSyncedFor] = useState(null);
  const [startupOk, setStartupOk] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Read the account's cloud copy before the app mounts, so its state starts
  // from data this device and the cloud agree on.
  const uid = session?.user?.id || null;
  useEffect(() => {
    if (!uid || syncedFor === uid) return;
    let cancelled = false;
    startupSync().then(ok => {
      if (cancelled) return;
      setStartupOk(ok);
      setSyncedFor(uid);
    });
    return () => { cancelled = true; };
  }, [uid, syncedFor]);

  useEffect(() => {
    if (syncedFor && !startupOk) settleAfterMount();
  }, [syncedFor, startupOk]);

  if (session === undefined) return null;
  if (!session) return <Login onLogin={setSession} />;
  if (syncedFor !== uid) return <div className="startup-sync">Syncing…</div>;
  return <App key={uid} session={session} />;
}

export default AppWrapper;
