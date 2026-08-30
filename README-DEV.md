# Keeper — dev notes

This repo IS the app. GitHub Pages serves `index.html` (plus icons/manifest)
at https://romanems.github.io/keeper-dashboard/

## Making changes
1. Edit files in `src/` (styles.css + the .jsx modules).
2. `python3 make_bundle.py` — rebuilds `index.html` from src.
3. `git add -A && git commit -m "…" && git push` — live in ~1 minute.

## Backend
Google Apps Script is only a JSON API (getState / saveState / getFinanceData),
gated by an access key. Its source lives in the Apps Script editor at
script.google.com — a reference copy may exist locally as `Code.gs`, which is
**gitignored on purpose: this repo is public and Code.gs contains the access
key. Never commit it.**

The `VAULT` constant in make_bundle.py is AES-GCM ciphertext of the keyed API
URL (safe to publish); the family passcode decrypts it in the browser.
