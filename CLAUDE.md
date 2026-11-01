# Banko Learn

The Japanese study section of BankoSpace (kana guide, practice, vocabulary,
flash cards, the always-on-top kana popup) as a desktop app of its own:
**Tauri v2 + React (Vite)**, Windows x64 and Apple Silicon macOS.

It signs in to the **same Supabase account** as BankoSpace and syncs through
the same `user_data` table (one row per user and key). The sync layer
(`src/sync.js`, `src/supabase.js`) is BankoSpace's, unchanged in behaviour;
read the Sync section of BankoSpace's CLAUDE.md before touching it.

## Sharing the account with BankoSpace — the rules

- `SYNC_KEYS` holds the study keys only (`kana_*`, `flashCards`,
  `flashCardGroups`). Banko Learn never reads or writes any other row.
  `tests/isolation.test.js` checks this; keep it passing.
- Device status rows use the prefix `__learnstatus:`, not `__status:`, so
  BankoSpace does not list Banko Learn as one of its devices.
- No account-wide housekeeping from here (BankoSpace's legacy
  `anthropic_api_key` purge was removed for that reason).
- Theme, profile and other settings are local to this app, not synced: they
  are BankoSpace rows.

## Commands

```bash
npm install --legacy-peer-deps
npm test
npm run build
cd src-tauri && cargo build
```

The binary embeds the frontend: after a frontend change run `npm run build`
and then `cargo build`. Builds need `VITE_SUPABASE_URL` and
`VITE_SUPABASE_KEY` (`.env`, never committed).

## Releasing

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`,
   `src-tauri/Cargo.toml` and `APP_VERSION` in `src/App.jsx`.
2. Commit, push `main`, push a tag `vX.Y.Z`.
3. `.github/workflows/release.yml` builds and publishes the release with a
   signed `latest.json` for the in-app updater. The signing key is Banko
   Learn's own (secret `TAURI_SIGNING_PRIVATE_KEY`; local copy in
   `%USERPROFILE%\.tauri\bankolearn.key`, never in the repo).

Only commit, push or release when the owner asks. Commit messages end with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
