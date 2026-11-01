# Banko Learn

A desktop app for learning Japanese: every kana with how it sounds and how to
write it, practice drills for the rows you choose, a vocabulary list in
folders, and flash cards with review. A small always-on-top practice window
can stay open beside whatever else you are doing.

Banko Learn signs in with your **BankoSpace** account. Your study progress
(learned words, vocabulary, flash cards, stats) is shared between Banko Learn,
BankoSpace and your other devices.

## Download

Get the latest version from
[Releases](https://github.com/berkbankoglu/BankoLearn/releases/latest):

- **Windows:** `Banko.Learn_x.y.z_x64-setup.exe`
- **macOS (Apple Silicon):** `Banko.Learn_x.y.z_aarch64.dmg`

The app updates itself: when a new version is out, an **Update** button
appears at the bottom of the sidebar.

## Keyboard

| Keys | Page |
| --- | --- |
| Ctrl/⌘ + 1 | Guide |
| Ctrl/⌘ + 2 | Practice |
| Ctrl/⌘ + 3 | Vocabulary |
| Ctrl/⌘ + 4 | Flash Cards |

## Building from source

```bash
npm install --legacy-peer-deps
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_KEY
npm test
npm run build
cd src-tauri && cargo build
```

Built with Tauri v2, React and Vite.
