// Recording studio: a Playwright recorder with a brand-aware visible cursor and a persistent
// lower-third that advances per step, plus shot() for live, annotated screenshots.
//
// This is the reusable CORE — it carries no app-specific constants. A demo's own script imports
// these functions, defines its own URLs/selectors, and passes a CFG (see config.example.mjs).
//
// Playwright is loaded via createRequire because it ships CommonJS. Resolve it plainly first — this
// finds a global install on NODE_PATH (a shunt guest bakes one in) with no machine-specific path —
// and fall back to a fixed host install location only if that fails.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/Users/user/node_modules/playwright'));
}

// Annotation colour for shot() boxes. Set from CFG at launch(); SSW red by default.
let ANNOTATE = '#CC4141';

// Annotation-hold tracking. The dead-air trim cuts runs of pixel-identical frames; a held annotation ring
// IS such a run (static ring + static cursor) but is intentional read-time pacing, not dead air. Detecting
// the ring post-hoc is unreliable (the cursor shares the ring colour), so the recorder simply DECLARES when
// it holds a ring: `shot()` records [start,end] seconds (relative to this recording's start), `finish()`
// writes them to a `<finalName>.annot.json` sidecar, and `trimDeadAir` exempts those ranges. Reset per launch.
let _recT0 = 0;
let _annot = [];
const _recNow = () => (Date.now() - _recT0) / 1000;

function overlayScript(cfg) {
  return `(() => {
  if (window.__studio) return; window.__studio = true;
  const ACCENT=${JSON.stringify(cfg.accent)}, CUR=${JSON.stringify(cfg.cursor)};
  function add() {
    if (!document.body) return;
    if (!document.getElementById('__cur')) {
      const c=document.createElement('div'); c.id='__cur';
      // Z-ORDER (top → bottom): lower-third (__lt) > annotation ring (__hl) > cursor (__cur) > ripple (__curR).
      // The cursor is the "recorded" content layer, so the production chrome (caption, then ring) composites
      // ABOVE it — a cursor drawing on top of the lower-third reads as a glitch and breaks immersion.
      c.style.cssText='position:fixed;z-index:2147483645;margin:-2px 0 0 -2px;pointer-events:none;left:-300px;top:-300px;transform-origin:top left;transition:transform .1s ease;';
      // A real arrow pointer (tip at the hotspot) in the cursor colour with a white outline + shadow so it
      // reads on any background — not a round dot (which gets mistaken for a record indicator).
      c.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.55));"><path d="M2 2 L2 22 L7 17 L10.5 24 L13.5 22.7 L10 16 L17 16 Z" fill="'+CUR+'" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      const r=document.createElement('div'); r.id='__curR';
      r.style.cssText='position:fixed;z-index:2147483644;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid '+CUR+';pointer-events:none;left:-300px;top:-300px;opacity:0;';
      document.body.appendChild(r);
      addEventListener('mousemove',e=>{const x=document.getElementById('__cur');if(x){x.style.left=e.clientX+'px';x.style.top=e.clientY+'px';}},true);
      addEventListener('mousedown',e=>{const x=document.getElementById('__cur');if(x)x.style.transform='scale(.55)';const rr=document.getElementById('__curR');if(rr){rr.style.transition='none';rr.style.left=e.clientX+'px';rr.style.top=e.clientY+'px';rr.style.opacity='.95';rr.style.transform='scale(1)';requestAnimationFrame(()=>{rr.style.transition='all .45s ease-out';rr.style.opacity='0';rr.style.transform='scale(2.5)';});}},true);
      addEventListener('mouseup',()=>{const x=document.getElementById('__cur');if(x)x.style.transform='scale(1)';},true);
    }
    if (!document.getElementById('__lt')) {
      // INLINE styles only — a CSP like "default-src 'self'" (no style-src 'unsafe-inline' for
      // elements) silently discards an injected <style>'s rules, leaving the card unstyled static
      // text in the document flow. Inline style attributes survive on every page we've met.
      const lt=document.createElement('div'); lt.id='__lt';
      lt.style.cssText='position:fixed;left:40px;bottom:40px;z-index:2147483647;display:flex;align-items:stretch;min-width:560px;max-width:1180px;min-height:88px;background:#fff;border-radius:14px;box-shadow:0 12px 36px rgba(10,20,50,.30);overflow:hidden;font-family:-apple-system,Helvetica,Arial,sans-serif;opacity:0;transform:translateY(16px);transition:opacity .35s ease,transform .35s ease;';
      const b=document.createElement('div'); b.className='b';
      b.style.cssText='padding:14px 128px 14px 28px;display:flex;flex-direction:column;justify-content:center;gap:4px;flex:1;';
      const k=document.createElement('div'); k.className='k';
      k.style.cssText='font-size:13px;font-weight:800;letter-spacing:.14em;color:'+ACCENT+';text-transform:uppercase;';
      const t=document.createElement('div'); t.className='t';
      t.style.cssText='font-size:26px;font-weight:650;color:#10151d;line-height:1.12;';
      const s=document.createElement('div'); s.className='s';
      s.style.cssText='font-size:14.5px;color:#5a6473;line-height:1.2;';
      b.append(k,t,s);
      const e=document.createElement('div'); e.className='e';
      e.style.cssText='position:absolute;right:0;top:0;bottom:0;width:128px;background:'+ACCENT+';clip-path:polygon(40% 0,100% 0,100% 100%,0 100%);display:flex;align-items:center;justify-content:flex-end;padding-right:24px;';
      const es=document.createElement('span');
      es.style.cssText='color:#fff;font-size:34px;font-weight:800;';
      e.append(es);
      lt.append(b,e);
      document.body.appendChild(lt);
    }
  }
  window.__setStep=(n,t,s)=>{const lt=document.getElementById('__lt');if(!lt)return;lt.querySelector('.k').textContent='Step '+n;lt.querySelector('.t').textContent=t;lt.querySelector('.s').textContent=s||'';lt.querySelector('.s').style.display=s?'block':'none';lt.querySelector('.e span').textContent=n;lt.style.opacity='1';lt.style.transform='none';};
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  new MutationObserver(()=>{ if(!document.getElementById('__cur')||!document.getElementById('__lt')) add(); }).observe(document.documentElement,{childList:true,subtree:true});
})();`;
}

// Launch a 1920x1080 recording context with the cursor + lower-third overlays injected.
export async function launch(outDir, cfg, storageState = null) {
  ANNOTATE = cfg.annotate || cfg.cursor || '#CC4141';
  // A locally-served dev HTTPS cert is a self-signed LEAF (Basic Constraints: not a CA); Chromium's
  // builtin verifier requires CA:true on a trust anchor regardless of any system/NSS trust, so it
  // throws net::ERR_CERT_INVALID against it. --allow-insecure-localhost waives cert errors scoped to
  // literal localhost/127.0.0.1 origins — exactly where these recordings always run — instead of the
  // blanket ignoreHTTPSErrors.
  const browser = await chromium.launch({ headless: true, args: ['--allow-insecure-localhost'] });
  const opts = { viewport: { width: 1920, height: 1080 }, recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } } };
  if (storageState) opts.storageState = storageState; // reuse a saved auth session so no login is recorded
  const context = await browser.newContext(opts);
  await context.addInitScript(overlayScript(cfg));
  const page = await context.newPage();
  _recT0 = Date.now(); _annot = []; // recording clock starts ~now (video frame 0 ≈ page creation)
  return { browser, context, page };
}

// CORE (generic): log in once OFF-camera (no recording) and persist the session to `statePath`, so each
// recorded segment opens already-authenticated (no login flash). `urls` are the app origins to authenticate
// (visit each; a shared IdP usually means logging into one authenticates the rest, but visiting captures
// each origin's cookies). `creds` + the form selectors are supplied by the caller — no app specifics here.
// `creds` is a list of credential attempts the caller supplies — `[{ user, pass }, …]` (a single object is
// also accepted) — tried in order until one logs in. The core only knows "try each attempt until the login
// form is gone"; it has NO knowledge of which passwords exist, how many there are, or any app specifics —
// the caller (the specific demo) owns that. Selectors default to a common convention; override per app.
export async function saveAuth(statePath, urls, creds, { userSel = 'input[name="Input.Username"]', passSel = 'input[type=password]', submitSel = 'button:has-text("Login")' } = {}) {
  const attempts = Array.isArray(creds) ? creds : [creds];
  // See the leaf-cert/CA:true note on launch() above — same dev cert, same fix, never ignoreHTTPSErrors.
  const browser = await chromium.launch({ headless: true, args: ['--allow-insecure-localhost'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  // A login is only successful when the password field is gone AND we're no longer parked on a
  // sign-in / lockout page. Some IdPs lock an account after N failed attempts and serve a lockout
  // page that *also* has no password field — treating that as success saves a dead session that
  // silently redirects back to login on every later use. Guard on the URL, not just the field.
  const loggedIn = async () => (await page.locator(passSel).count()) === 0
    && !/\/Account\/(Login|Lockout)/i.test(page.url());
  let authed = false;
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);
    if (await page.locator(passSel).count()) {
      for (const c of attempts) {
        await page.fill(userSel, c.user).catch(() => {});
        await page.fill(passSel, c.pass).catch(() => {});
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}), page.click(submitSel).catch(() => {})]);
        await page.waitForTimeout(6000);
        if (/\/Account\/Lockout/i.test(page.url())) {
          await context.close(); await browser.close();
          throw new Error(`saveAuth: account locked out at ${page.url()} — too many failed attempts. Unlock it / use the correct password, then retry. (NOT saving a dead session.)`);
        }
        if (await loggedIn()) break; // genuinely authenticated — stop trying attempts
      }
    }
    if (await loggedIn()) {
      authed = true;
      // Settle: re-load the app once and wait so the durable auth cookies actually land before we
      // capture. SPA/WASM auth (e.g. Blazor + OIDC) finishes its handshake AFTER the first redirect —
      // capturing immediately grabs only the transient handshake cookies (Nonce/Correlation) and misses
      // the real session cookie (idsrv.session / .AspNetCore.Identity.Application / __Host-* tokens), so
      // the saved state silently bounces back to login on reuse. The reload forces them to persist.
      await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(5000);
    }
  }
  if (!authed) {
    await context.close(); await browser.close();
    throw new Error(`saveAuth: could not authenticate (still on ${page.url()}). Check the credentials/selectors — refusing to save an unauthenticated session.`);
  }
  await context.storageState({ path: statePath });
  await context.close(); await browser.close();
  console.log('saved auth state →', statePath);
}

export const pause = (page, ms = 1200) => page.waitForTimeout(ms);
export const setStep = (page, n, t, s) => page.evaluate(([n, t, s]) => window.__setStep && window.__setStep(n, t, s), [n, t, s]).catch(() => {});

// Move the cursor to a target (so it visibly travels) then click. Cheap insurance against the
// recording showing a teleporting click with no pointer motion.
// Cursor position is tracked so moves are a real, frame-spanning glide (the recording captures the
// travel) rather than an instant jump. Ease-in-out, distance-proportional duration. The glide is the
// connective motion between actions — pair it with short settle waits (not long frozen pauses) so the
// video is always doing something. See references/recording.md on pacing.
let LAST = { x: 960, y: 540 };
export async function slowMoveTo(page, x, y) {
  const sx = LAST.x, sy = LAST.y, dx = x - sx, dy = y - sy;
  const ms = Math.min(950, Math.max(320, Math.hypot(dx, dy) * 1.15));
  const frames = Math.max(10, Math.round(ms / 22));
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
    await page.mouse.move(sx + dx * e, sy + dy * e);
    await page.waitForTimeout(22);
  }
  LAST = { x, y };
}

// Visibly scroll (mouse wheel) ONLY when the target is actually off-screen / clipped, bringing it into view
// with a smooth wheel — never a `scrollIntoView` jump, and never scroll an element that's already visible.
// (The old "centre it in the viewport" goal was the bug: a near-top element like a search box has its centre
// above the middle, so it wheeled UP against the top of the page forever — the page never moved, firing
// hundreds of wheel events that jitter the sticky header while the cursor sat frozen.) Direct page
// manipulation reads as fake; the recording must be real user input only.
const HEADER_H = 72;   // don't let the target hide under a sticky top bar
const BOTTOM_M = 60;   // keep it clear of the very bottom edge
export async function scrollTo(page, locator) {
  const el = locator.first();
  const vh = page.viewportSize()?.height || 1080;
  const vw = page.viewportSize()?.width || 1920;
  // If the target lives in an INNER scroll container (a panel that scrolls, not the window), a wheel event
  // only scrolls whatever is under the cursor — so before wheeling, move the cursor OVER the target's own
  // column at mid-viewport. Without this, the wheel hit the cursor's stale position (e.g. the top tab strip),
  // the panel never moved, scrollTo bailed, and moveClick then glided the cursor to the target's STILL
  // off-screen coordinates (cursor flies off the page) while the click auto-scrolled the panel in one jump —
  // the "cursor goes off-page then the button is suddenly in focus" jank. Positioning the cursor over the
  // panel makes the wheel scroll the right thing AND visibly leads the scroll.
  let positioned = false;
  let misses = 0, lastTop = null, stuck = 0;
  for (let i = 0; i < 200; i++) {
    const r = await Promise.race([el.boundingBox().catch(() => null), new Promise(res => setTimeout(() => res(null), 500))]);
    if (!r) { if (++misses >= 3) return; await page.waitForTimeout(16); continue; }
    misses = 0;
    const top = r.y, bottom = r.y + r.height;
    // Already on-screen and clickable (not clipped by the header or the bottom edge)? Don't scroll at all.
    if (top >= HEADER_H && bottom <= vh - BOTTOM_M) return;
    if (!positioned) { // glide the cursor over the target's column so the wheel scrolls THAT container
      positioned = true;
      const cx = Math.max(60, Math.min(vw - 60, r.x + Math.min(r.width / 2, 220)));
      await slowMoveTo(page, cx, Math.round(vh / 2));
    }
    // No-progress guard: if the page didn't move after the last wheel, we're at a scroll limit — stop
    // rather than wheel uselessly (this is what jittered the header). A few no-progress ticks → bail.
    if (lastTop != null && Math.abs(top - lastTop) < 1) { if (++stuck >= 3) return; } else stuck = 0;
    lastTop = top;
    const dir = top < HEADER_H ? -1 : 1; // clipped at top → wheel up; below the fold → wheel down
    await page.mouse.wheel(0, dir * 26);
    await page.waitForTimeout(16);
  }
}

export async function moveClick(page, locator, { pre = 250, post = 1100 } = {}) {
  const el = locator.first();
  await scrollTo(page, el); // visible wheel scroll, not a jump
  const box = await el.boundingBox().catch(() => null);
  if (box) { await slowMoveTo(page, box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(pre); }
  // REAL actionable click on the real element — Playwright waits until it's genuinely hittable. No force,
  // no synthetic JS click, no blind coordinate. If intercepted, fix the UI state, don't fake the click.
  await el.click({ timeout: 8000 });
  await page.waitForTimeout(post);
}

export async function park(page, x = 960, y = 280) { await slowMoveTo(page, x, y).catch(() => {}); }

// CORE (generic, app-agnostic): is `locator` actually the hit target at its own centre — i.e. a real click
// there lands on it, not on something clipping/overlaying it? Uses elementFromPoint (a height check
// false-positives for collapsed-but-rendered accordion children). Build menu-expand conditions from this.
export async function isClickable(page, locator) {
  return locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 5 || r.width < 5) return false;
    const hit = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + r.height / 2);
    if (!hit) return false;
    return el.contains(hit) || hit === el || (hit.closest && el.contains(hit.closest('a,button')));
  }).catch(() => false);
}

// CORE (generic, app-agnostic): navigate by real-clicking an ordered path of menu steps toward a
// destination. Each step is `{ target, when?, opts?, after? }`: `target` is the locator to REAL-click; the
// optional async `when()` returns false to SKIP that step (e.g. don't toggle an already-open menu, don't
// expand an already-clickable group — build these with `isClickable`); `after` waits ms after the click.
// The last step is the destination. This knows nothing about any app/page/URL — an app wrapper (e.g. a
// `navigate-<app>` skill's helper) supplies the selectors and conditions and calls this. See SKILL.md
// "Core vs app-specific wrappers".
export async function navPath(page, steps) {
  for (const step of steps) {
    const loc = step.target ?? step;
    if (step.when && !(await step.when())) continue;
    await moveClick(page, loc, step.opts || { post: 1100 });
    if (step.after) await page.waitForTimeout(step.after);
  }
}

// Capture a still straight off the live recording page, so the artifact screenshot is exactly a
// frame of what the video shows at that moment. Optionally ring a target element with a coloured box
// (default = the CFG annotation colour). Lower-third + cursor stay in shot on purpose.
export async function shot(page, outPath, { highlight = null, settle = 500, color = ANNOTATE } = {}) {
  let box = null;
  if (highlight) {
    const el = highlight.first();
    await scrollTo(page, el); // visible wheel scroll to the element, never a jump
    await page.waitForTimeout(150);
    box = await el.boundingBox().catch(() => null);
    // Don't move the cursor to the ringed element — the ring already shows what we're pointing at, and the
    // cursor pointing at it too is redundant. Leave the cursor wherever it was. (The annotation hold is kept
    // by the trim via the recorder-declared annot range below, so it doesn't need a cursor move to "break"
    // a static span any more.)
  }
  if (box) {
    await page.evaluate(([b, c]) => {
      let d = document.getElementById('__hl');
      if (!d) { d = document.createElement('div'); d.id = '__hl'; document.body.appendChild(d); }
      d.style.cssText = 'position:fixed;z-index:2147483646;left:' + (b.x - 9) + 'px;top:' + (b.y - 9) + 'px;width:' + (b.width + 18) + 'px;height:' + (b.height + 18) + 'px;border:4px solid ' + c + ';border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.7),0 6px 16px rgba(0,0,0,.28);pointer-events:none;';
    }, [box, color]);
  }
  // Hold the ring on screen long enough to read — forced to >= 1.8s (a ~500ms ring races past). The
  // hold is pixel-static, so record its [start,end] as an annotation range (declared to `trimDeadAir`
  // via the sidecar) so the trim keeps it as intentional read-time pacing rather than clamping it as
  // dead air.
  const holdStart = box ? _recNow() : null;
  const holdMs = highlight ? Math.max(settle, 1800) : settle;
  await page.waitForTimeout(holdMs);
  await page.screenshot({ path: outPath });
  if (box && holdStart != null) _annot.push([holdStart, _recNow()]);
  await page.evaluate(() => { const d = document.getElementById('__hl'); if (d) d.remove(); }).catch(() => {});
  if (highlight) await page.waitForTimeout(250); // small beat after the ring clears before moving on
}

// Generic form login. Pass the sign-in URL, credentials, and (optionally) override the selectors.
export async function login(page, { url, user, pass, userSelector = 'input[name="Input.Username"]', passSelector = 'input[type=password]', submitSelector = 'button:has-text("Login")', settle = 6000 }) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(passSelector, { timeout: 30000 });
  if (user) await page.fill(userSelector, user).catch(() => {});
  await page.fill(passSelector, pass);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}), page.click(submitSelector)]);
  await page.waitForTimeout(settle);
}

// Close the context (flushes the .webm) and rename the single recording to finalName.
export async function finish(context, browser, outDir, finalName, page) {
  const fs = await import('node:fs');
  // Map THIS context's recording precisely via page.video().path(). Reading the dir and renaming
  // files[0] grabs an arbitrary/stale hash-named webm once several recordings accumulate in outDir —
  // which silently pairs the wrong video with a segment. Always pass `page`.
  const video = page ? page.video() : null;
  const annot = _annot.slice(); // annotation-hold ranges for this recording (consumed by trimDeadAir)
  await context.close(); await browser.close(); // video.path() resolves only after the context closes
  // Write the annotation sidecar next to the named recording (the trim's keep-ranges).
  try { fs.writeFileSync(`${outDir}/${finalName}.annot.json`, JSON.stringify(annot)); } catch { /* non-fatal */ }
  if (video) {
    const p = await video.path().catch(() => null);
    if (p && fs.existsSync(p)) { fs.renameSync(p, `${outDir}/${finalName}`); return `${outDir}/${finalName}`; }
  }
  // Fallback (no page passed): newest webm that isn't already a named output.
  const files = fs.readdirSync(outDir)
    .filter(f => f.endsWith('.webm') && !f.startsWith('rec-') && !f.startsWith('seg-'))
    .map(f => ({ f, t: fs.statSync(`${outDir}/${f}`).mtimeMs })).sort((a, b) => b.t - a.t);
  if (files.length) { fs.renameSync(`${outDir}/${files[0].f}`, `${outDir}/${finalName}`); return `${outDir}/${finalName}`; }
  return null;
}
