#!/usr/bin/env python3
"""
make_bundle.py
Builds index.html (the complete Keeper app as one static page) from src/.
This repo IS the deployment: after building, commit + push to publish via
GitHub Pages at https://romanems.github.io/keeper-dashboard/

The app is served from GitHub Pages and talks to Apps Script only as a JSON
API (Code.gs lives in the Apps Script editor — NOT in this public repo,
because it contains the access key). The passcode gate is built into the
page: it decrypts the keyed API URL (AES-GCM vault) on first unlock, stores
it in localStorage, and the app syncs through it from then on.

Usage:
    python3 make_bundle.py
    git add -A && git commit -m "…" && git push
"""

import os, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')

# Order matters — each file may rely on globals set by earlier ones.
JSX_FILES = [
    'tweaks-panel.jsx',
    'store_sync.jsx',
    'sidebar.jsx',
    'home.jsx',
    'shopping.jsx',
    'tasks.jsx',
    'notes.jsx',
    'quotes.jsx',
    'trips.jsx',
    'finance.jsx',
    'app.jsx',
]

# Encrypted vault: the keyed Apps Script API URL, AES-GCM-encrypted with the
# family passcode (this is ciphertext — safe in a public repo).
VAULT = ('{ salt: "ncCgQeuDF2XwoB7bdDtcKw==", iv: "03CALX46wkiW2q/p", '
         'data: "afGXqgoaiBr+rMVbOWzRThEzpmZrsGJ6bbTP7/JRYDT3wBiDlR6eiuy8rQ6uUItfHTi6JStHFsRpEYsxsuMf+R+bBSkIUpoU/uKOYKiiGnQ9mZkwPd+pAOPCk3X4OkX+GF51U60BB5QyarZuXG8NfRXhWKQkfkB9BXlenaZwqGCPkUUJitDiUXH4PFOJ6nIXXnvIESRPJi7DYLztw3Jf/SVClk0p2Ep8O4kjRHlKjvDIASaN5A==" }')

GATE_CSS = """
/* ── Passcode gate (covers the app until the API URL is unlocked) ── */
#gate {
  position: fixed; inset: 0; z-index: 99999; background: var(--bg);
  display: grid; place-items: center; padding: 24px; box-sizing: border-box;
}
.gate-card {
  width: 340px; max-width: 100%; text-align: center; background: var(--paper);
  border: 1px solid var(--line); border-radius: 16px; padding: 36px 30px 26px;
  box-shadow: var(--shadow-card);
}
.gate-card.shake { animation: gateshake .4s; }
@keyframes gateshake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
.gate-mark { width: 54px; height: 54px; border-radius: 13px; margin: 0 auto 14px;
  background: var(--grad-accent); box-shadow: var(--bevel-accent);
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 12px; box-sizing: border-box; }
.gate-mark span { border-radius: 3px; }
.gate-mark span:nth-child(1) { background: rgba(255,255,255,0.93); }
.gate-mark span:nth-child(2) { background: rgba(255,255,255,0.57); }
.gate-mark span:nth-child(3) { background: rgba(255,255,255,0.57); }
.gate-mark span:nth-child(4) { background: rgba(255,255,255,0.31); }
.gate-card h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin: 0 0 6px; }
.gate-card p  { color: var(--muted); font-size: 13px; margin: 0 0 20px; line-height: 1.5; }
.gate-card input {
  width: 100%; box-sizing: border-box; font-size: 20px; text-align: center; letter-spacing: 6px;
  padding: 12px; border: 1px solid var(--line-2); border-radius: 10px; outline: none;
  background: var(--bg); margin-bottom: 12px; color: var(--ink);
  font-family: var(--font-mono);
}
.gate-card input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,102,204,0.12); }
.gate-card input.err { border-color: var(--red); background: var(--red-light); }
.gate-card button {
  width: 100%; padding: 12px; font-size: 14px; font-weight: 600; color: #fff;
  border: none; border-radius: 10px; cursor: pointer;
  background: var(--grad-accent); box-shadow: var(--bevel-accent);
}
.gate-card button:active { transform: scale(0.97); }
.gate-hint { font-size: 10px; color: var(--muted-2); letter-spacing: 0.8px; text-transform: uppercase; margin-top: 16px;
  font-family: var(--font-mono); }
"""

GATE_HTML = """
<div id="gate">
  <form class="gate-card" id="gate-card" onsubmit="return __gateGo(event)">
    <div class="gate-mark"><span></span><span></span><span></span><span></span></div>
    <h1>Keeper</h1>
    <p>Enter the family passcode to unlock the dashboard on this device.</p>
    <input id="gate-pw" type="password" inputmode="text" autocomplete="current-password" placeholder="passcode">
    <button type="submit">Unlock</button>
    <div class="gate-hint">Remembered on this device after first unlock</div>
  </form>
</div>
<script>
// Gate runs BEFORE the app scripts: if the API URL is already stored, remove
// the overlay so the app (which reads localStorage at load) boots synced.
// On a fresh unlock we reload so the store re-evaluates with the URL present.
const __GATE_VAULT = VAULT_PLACEHOLDER;
const __GATE_LS = 'studio.exec.url';

// ── Auto-update ────────────────────────────────────────────────────────────
// A home-screen app on iOS can keep running an old copy of this page long
// after a deploy. On load and whenever the app returns to the foreground,
// fetch the live page uncached; if its build id differs from ours, reload
// via a unique URL (bypasses every cache). One attempt per build id per
// session, so a stale CDN can never cause a reload loop.
const __BUILD = 'BUILD_PLACEHOLDER';
(function () {
  if (window.top !== window.self) return;
  async function check() {
    try {
      const r = await fetch(location.pathname + '?bc=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const m = (await r.text()).match(/const __BUILD = '([0-9a-f]+)'/);
      if (!m || m[1] === __BUILD) return;
      const k = 'keeper.updateTried';
      if (sessionStorage.getItem(k) === m[1]) return;
      sessionStorage.setItem(k, m[1]);
      location.replace(location.pathname + '?b=' + m[1]);
    } catch (_) {}
  }
  setTimeout(check, 2500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();

(function () {
  // Old bookmarks to the retired script.google.com URL land here via a
  // redirect that Google runs INSIDE its own wrapper iframe — leaving the
  // app framed under Google's banner at desktop width. Script-driven
  // top-navigation is blocked by Google's sandbox, but a user-tapped
  // target="_top" link is allowed — so offer exactly that and stop.
  if (window.top !== window.self) {
    try { window.top.location.href = 'https://romanems.github.io/keeper-dashboard/'; } catch (_) {}
    document.getElementById('gate').innerHTML =
      '<a href="https://romanems.github.io/keeper-dashboard/" target="_top" class="gate-card" ' +
      'style="display:block;text-decoration:none;color:inherit;font-size:16px;font-weight:600;">' +
      'Keeper has moved to a new address.<br><br>' +
      '<span style="color:#0066CC">Tap here to open it</span><br><br>' +
      '<span style="font-size:12px;font-weight:400;color:#8a7060">Then delete the old home-screen icon and add this page instead.</span></a>';
    return;
  }
  let saved = null;
  try { saved = localStorage.getItem(__GATE_LS); } catch (_) {}
  if (saved) document.getElementById('gate').remove();
})();

// ── iOS standalone keyboard guard ──────────────────────────────────────────
// When the keyboard opens, standalone iOS force-pans the whole app window
// (window scroll) even though the layout is overflow:hidden — pushing modal
// tops and headers off-screen and leaving the page shifted after the
// keyboard closes. Counter it: snap the window pan back to origin whenever
// the visual viewport changes, and instead reveal the focused field by
// scrolling the app's own inner scroller (.main, honoring scroll-padding).
(function () {
  if (!('visualViewport' in window)) return;
  let raf = null;
  function snap() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
      const d = document.documentElement;
      if (d.scrollLeft) d.scrollLeft = 0;
      if (d.scrollTop) d.scrollTop = 0;
      const el = document.activeElement;
      if (el && el.closest && el.closest('.main') &&
          (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) {
        const vh = window.visualViewport.height;
        const r = el.getBoundingClientRect();
        if (r.bottom > vh - 40 || r.top < 60) el.scrollIntoView({ block: 'center' });
      }
    });
  }
  window.visualViewport.addEventListener('resize', snap);
  window.visualViewport.addEventListener('scroll', snap);
  document.addEventListener('focusin', function () { setTimeout(snap, 350); });
  document.addEventListener('focusout', function () { setTimeout(snap, 100); });
})();

function __gateB64d(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function __gateGo(e) {
  e.preventDefault();
  const pw = document.getElementById('gate-pw');
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw.value), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: __gateB64d(__GATE_VAULT.salt), iterations: 310000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: __gateB64d(__GATE_VAULT.iv) }, key, __gateB64d(__GATE_VAULT.data));
    const url = new TextDecoder().decode(plain);
    try { localStorage.setItem(__GATE_LS, url); } catch (_) {}
    window.location.reload();
  } catch (_) {
    const card = document.getElementById('gate-card');
    pw.classList.add('err'); card.classList.add('shake');
    pw.value = '';
    setTimeout(() => { pw.classList.remove('err'); card.classList.remove('shake'); }, 500);
  }
  return false;
}
</script>
"""

def read(name):
    path = os.path.join(SRC, name)
    if not os.path.exists(path):
        print(f'  MISSING: {name}')
        return ''
    with open(path, encoding='utf-8') as f:
        return f.read()

def main():
    print('Building index.html from src/ ...')

    css = read('styles.css')

    jsx_blocks = []
    for fname in JSX_FILES:
        content = read(fname)
        if content:
            jsx_blocks.append(f'<!-- {fname} -->\n<script type="text/babel">\n{content}\n</script>')
            print(f'  + {fname}')

    # Build id = content hash, so identical sources keep rebuilding byte-for-byte
    build_id = hashlib.sha1((css + ''.join(jsx_blocks) + GATE_HTML + GATE_CSS + VAULT).encode('utf-8')).hexdigest()[:10]
    gate = GATE_HTML.replace('VAULT_PLACEHOLDER', VAULT).replace('BUILD_PLACEHOLDER', build_id)
    print(f'  build {build_id}')

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Keeper</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Keeper">
<meta name="theme-color" content="#f0ebe3">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{css}
{GATE_CSS}
</style>
</head>
<body>
{gate}
<div id="root"></div>

<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin></script>

{chr(10).join(jsx_blocks)}
</body>
</html>
"""

    out = os.path.join(HERE, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)

    size_kb = os.path.getsize(out) / 1024
    print(f'\nDone. index.html written ({size_kb:.0f} KB)')
    print('Deploy: git add -A && git commit -m "…" && git push')

if __name__ == '__main__':
    main()
