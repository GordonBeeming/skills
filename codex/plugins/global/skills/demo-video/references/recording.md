# Recording

The recorder core is `scripts/studio.mjs`. It takes a CFG (see `config.example.mjs`) and carries no
app-specific constants — your `videoN.mjs` defines URLs/selectors and drives the flow.

## Guest-mode recording (app running in an isolated dev container)

**Record where the app runs.** When the target app runs inside an isolated dev container (a shunt
siding) rather than directly on the host, run the studio recording step **in the guest** — that way
several sidings can record in parallel instead of contending for the one host-visible app. Only the
recording step moves; everything after it stays on the host exactly as elsewhere in this skill.

1. Copy the runner (`videoN.mjs`), the core (`studio.mjs`/`cards.mjs`), and the version's `config.mjs`
   into the siding's standing output directory on the host — that same directory is mounted into the
   guest at `/out`.
2. Run the recorder via the container tooling's exec command, targeting the copied script inside the
   guest (e.g. `shunt-dev run <siding> node /out/demo/<runner>.mjs`).
3. Recorded webm segments and stills land back under that same standing output directory. Copy them
   into the version's `vid/` folder in the artifacts working dir before building — assembly reads from
   there like any other run.

Assembly (`assemble.mjs`, ffmpeg), card rendering, and the HTML artifact are host-only — none of that
moves into the guest. `recordVideo`'s output size is driven by the size/viewport you
already set in `launch()`; guest mode doesn't change that.

**The Chromium launch options apply the same way in both worlds — no guest-only branch.** The target
app's dev HTTPS cert is a self-signed leaf on the host exactly as it is in a guest, and Chromium's own
verifier rejects a self-signed leaf as a trust anchor regardless of any system/NSS trust — that's why
`launch()` and `saveAuth()` always pass `args: ['--allow-insecure-localhost']` to `chromium.launch()`,
unconditionally. The flag waives cert errors scoped to literal `localhost`/`127.0.0.1` origins, which
is all these recordings ever hit. Never reach for `ignoreHTTPSErrors` instead — it disables certificate
checking far more broadly than the one cert this is actually working around.

**Auth/storageState in guest mode** follows the same `saveAuth` recipe as below, just run and
persisted in-guest: save the state file under the standing output directory so every segment in that
guest reuses it, and it stays inspectable from the host afterwards.

## API

- `launch(outDir, cfg)` → `{ browser, context, page }`. Opens a headless 1920×1080 context recording to
  `outDir`, with the cursor + lower-third overlays injected via `addInitScript` (so they survive
  navigations). Sets the `shot()` annotation colour from `cfg.annotate`.
- `login(page, { url, user, pass, userSelector?, passSelector?, submitSelector?, settle? })` — generic
  form login. **Only call this if the env needs auth** (see intake in `workflow.md`). Override the
  selectors when the form differs; for SSO see the auth note below.
- `pause(page, ms)` — wait (also lets the recording breathe on a beat).
- `setStep(page, n, title, subtext)` — set the lower-third. **Re-call after every full navigation** —
  a full page load wipes the injected overlay state, so the lower-third goes blank until you set it again.
- `moveClick(page, locator, { pre?, post? })` — scrolls the target into view, **glides the cursor to it**
  (via `slowMoveTo`, so the travel is captured across real frames — not a teleport), pauses, then clicks.
  Use this for every click. Falls back to a forced click if the element has no box.
- `slowMoveTo(page, x, y)` — the underlying ease-in-out, distance-proportional glide (≈320–950ms). Cursor
  position is tracked between calls. This is the connective motion between actions.
- `park(page, x?, y?)` — glide the cursor to a neutral spot before a still or a final frame.
- `shot(page, outPath, { highlight?, settle?, color? })` — screenshot the live page to `outPath`.
  `highlight` is a locator to ring with an annotation box (default colour = `cfg.annotate`, SSW red).
  The lower-third and cursor stay in frame on purpose — the still is exactly what the video shows.
- `finish(context, browser, outDir, finalName, page)` — close (flush the webm) and rename it to
  `finalName`. **Pass `page`** so it resolves *this* recording via `page.video().path()`; without it the
  fallback grabs the newest webm in the dir, which silently pairs the wrong video with a segment once
  several recordings have piled up in the output dir.

## Clicking elements an overlay intercepts (fix the UI state — don't fake or hop around it)

In a headless run, a fixed/overlay element (an expanded nav drawer, a sidebar over a table, a collapsed
accordion clipping its children) can sit between the pointer and the target, so a coordinate click lands on
the overlay and nothing happens. **Do not work around this by faking the click** (`el.evaluate(e => e.click())`,
dispatching synthetic events) or by `page.goto`-ing to the destination — both bypass the real user path and
read as fake on camera. Instead, **bring the target into a genuinely clickable state and then do a real
`locator.click()`** (via `moveClick`):

- Hit-test before clicking: `document.elementFromPoint(cx, cy)` at the target's centre tells you whether the
  top element there is the target (or a descendant) or something covering it. The core helper `isClickable`
  does exactly this.
- If it's covered, perform the **real action that uncovers it** first — expand the accordion that contains the
  item, open the menu, scroll the intercepting bar away — each as its own `moveClick`. The core `navPath` takes
  an ordered list of conditional steps (with `when` predicates) so you only click the steps that are actually
  needed (open the sidebar only if collapsed, expand the group only if the child isn't yet clickable, then
  click the child).
- Then click the target for real and confirm it worked (`waitForURL` / a visible change). If a real user
  genuinely *couldn't* reach it either, that's a bug to investigate, not script around (see SKILL rule #11).

Target framework SPA nav links by a stable attribute (e.g. `a[href*="…"]`) rather than visible text, which is
often duplicated across rows. A real `locator.click()` waits for the element to be actionable, so it also
surfaces a genuinely-stuck UI as a timeout (a signal) instead of silently no-op'ing like a synthetic click.

## Heavy SPA / WASM cold-boot loads

A client-rendered app (Blazor WASM, a big SPA bundle) doesn't have its nav/chrome in the DOM until the
runtime has downloaded and booted — which on a *cold* boot (first load, or the first load in a fresh process
right after capturing auth) can take many seconds, occasionally stalling mid-init. So the first interactive
element you wait for after a navigation needs a **generous** `waitFor` (e.g. 20–30s, not the default), and a
**reload-retry**: if it still hasn't attached, `page.reload()` once and wait again — a hard reload reliably
kicks a stalled boot. Don't treat the first cold-boot timeout as "element missing"; treat it as "not booted
yet". (This is also why reusing a saved `storageState` across segments beats re-authenticating every run —
fewer cold boots, and no auth churn.)

## Transient redirect / "starting…" pages

Some actions route through a transient page that *does* something and then forwards to the real destination
(a `/start/{id}` route that kicks a state change and redirects, a "Redirecting…" interstitial). Two rules:

- **Wait for the FINAL destination, not the first URL match.** A glob like `**/thing/**` matches the transient
  `/thing/start/{id}` immediately, so you proceed before the redirect lands. Match the destination shape
  precisely (e.g. the id directly under the route, not under a `/start/` segment) and then wait for the heavy
  content (the tabview, the form) to render.
- **Once the underlying state change has happened, the destination is safe to (re)load to recover a stall.**
  If the post-action redirect stalls on a cold boot, navigating straight to the now-valid destination is a
  legitimate recovery (the user already triggered the action) — distinct from page-hopping *instead of* the
  action. Loop: wait for the destination + its content; on miss, reload the destination; retry a few times.

## The overlays

- **Cursor** — a 26px filled dot (cursor colour) with a white border + dark ring shadow so it reads on
  any background, plus a click ripple. Driven by real `page.mouse` events, so `moveClick` makes it move.
- **Lower-third** — a white panel, bottom-left: `Step N` kicker (accent), title, subtext, and an accent
  angled edge on the right with a big white step number. `setStep` updates it; it animates in on first show.
- Both are re-added by a `MutationObserver` if the app's framework wipes them, and re-injected on every
  navigation via `addInitScript`.
- **Overlay z-order (top → bottom): lower-third → annotation ring → cursor → ripple.** The cursor reads as
  the *recorded* content layer, so the production chrome composites above it — the lower-third is the topmost
  element, the annotation ring sits just under it, and the cursor (and its ripple) sit below both. A cursor
  drawing on top of the lower-third panel looks like a glitch and breaks immersion, so the caption must always
  win that overlap. (Set in `overlayScript`'s `__lt`/`__cur`/`__curR` z-indexes and `shot()`'s `__hl`.)

## Scroll walkthroughs of a static page (a doc/reference artifact)

Recording a calm scroll-tour of a long page (e.g. an HTML reference the demo is *about*) is a valid segment,
but two things differ from an app flow:

- **Flip the lower-third AFTER the scroll lands on the section, not before.** The natural instinct —
  `setStep(n)` then `scrollTo(section n)` — leaves caption *n* on screen for the whole ~1–2s scroll away from
  section *n-1*, so the caption reads a section ahead of what's centred. Order it `scrollTo → setStep → hold`
  so the caption changes on arrival (hold-on-target).
- **`scrollTo(heading)` stops as soon as the heading is *anywhere* on screen — including at the very bottom**,
  which leaves the *previous* section filling the viewport under the new caption. To centre a section's own
  content, continue the wheel until the heading sits near the top (~110px): after `scrollTo`, loop
  `mouse.wheel(0, 26)` until the heading's `boundingBox().y` is small. (An `arrive(loc)` helper that wraps
  `scrollTo` + this nudge is the clean shape.) The last section can't reach the top (the page bottom caps the
  scroll) — that's fine as long as the section's content clears the lower-third.
- Build it with the light-page trim settings — see `assembly.md` (`noBlankDrop: true` + a larger `holdSec`);
  a white page otherwise gets gutted by the load-blank drop.

## Known rough edges

- **Horizontal tab-strip scrolling.** `scrollTo` is vertical-only by design. When a target tab lives in a
  framework tab strip that scrolls *horizontally* (e.g. a Radzen tabview with more tabs than fit), reaching an
  off-screen tab can look slightly off because the strip's own horizontal scroll isn't driven the way the
  vertical wheel is. Minor; only matters when the tab you need is scrolled out of the strip.

## Patterns

- **One `setStep` per beat, before the interactions for that beat.** After a click that triggers a full
  nav (not SPA routing), call `setStep` again on the new page.
- **`shot()` at the moment the UI is settled** — after the relevant pause, before moving on.
- **Annotate only the OUTCOME the step produced** — the new/changed thing the feature just created (a
  newly-created row, a result badge, a status that flipped). Do NOT box static controls (buttons,
  dropdowns), prompts/affordances, or pre-action previews (a "what will happen" count) — boxing those
  reads as random and buries the point. If a step's beat is just context with nothing newly created,
  call `shot(page, path)` with no `highlight` (a clean still). The annotation answers "where did the new
  thing show up?", not "where did I click?".
- **Don't move the cursor to the annotation.** The ring already shows what you're pointing at; the cursor
  pointing at it too is redundant. `shot()` rings the element and holds it, leaving the cursor wherever it was —
  it does NOT travel the cursor to the ringed thing. (The hold is kept by the trim via the recorder-declared
  annotation range, so it no longer needs a cursor move to break a static span.)
- **Pacing — glide, don't freeze.** The watchable rhythm is: the cursor is almost always *moving*, and
  the gaps between actions are short. Two levers:
  - Let the cursor glide (`moveClick`/`park` already do) — that smooth travel is the connective tissue,
    so you don't need long static holds to fill time.
  - Keep in-script `pause()`s to the minimum the app needs to settle/load reliably (≈1.5–3s), not the
    generous "definitely loaded" waits. Trim the dead air — a 7s hold on a settled dialog or an 8s wait
    on a finished job is frozen frames nobody needs. Keep a slightly longer beat (≈2.5s) only where the
    viewer must *read* a result.
  Avoid post-hoc speed-ups (see the webm-duration warning in `assembly.md`); pace it in the script.
- **Continuous browse, not a cut-up reel.** Each segment should play as one unbroken "the user does the
  thing": cursor travels → clicks → the page transitions → cursor travels to the next target. After a page
  settles, start moving toward the next target instead of parking and waiting. The dead-air trim only
  removes runs of pixel-identical frames with no annotation (see `assembly.md`) — so cursor movement and
  page transitions are never cut — but it's there as a safety net, not a licence to record long static
  dwells. If you find the build hard-cutting your browsing, the trim is mis-tuned, not too gentle.
- **Scroll is a smooth visible travel.** `scrollTo` wheels in small per-frame steps (~26px) so scrolling
  reads as continuous motion; never `scrollIntoView`/jump. A coarse step (the old ~90px) reads as stutter.

## Auth note (SSO / MSAL / biometric)

The headless capture browser has no SSO cookies and will stall on a provider login page. Options:
- **Local dev creds** → a plain `login()` works (the example signs in a seeded local user).
- **SSO/MSAL** → don't drive it headless. Ask the user to sign in for you in a headed browser and reuse
  the session, or capture a Playwright `storageState` once (headed) and load it into the context. If you
  need this, ask the user — don't guess credentials or try to automate the provider flow.

### `saveAuth` races a cold-boot SPA redirect — verify the saved state isn't empty

The core `saveAuth()` visits the app, waits a fixed few seconds, and if it sees **no password field** decides
you're already authenticated. On a **client-rendered SPA** (oidc-client-ts / MSAL / Blazor WASM) a *cold*
boot can take longer than that fixed wait to fetch its runtime config and redirect to the IdP — so `saveAuth`
sees no password field *because the redirect hasn't happened yet*, wrongly concludes "logged in", and saves an
**empty, unauthenticated** state (no cookies, no origins). The reused state then bounces straight back to
login. Two guards:
- **After `saveAuth`, assert the state is non-empty** — the JSON must have cookies and/or an `origins[]`
  entry with the IdP-user localStorage key; if it's empty, the capture failed silently.
- For a flaky cold boot, prefer an **app-specific auth wrapper** that waits on real signals rather than a
  timer: `waitForSelector('input[type=password]')` (generous timeout) → fill + submit → **`waitForFunction`
  until the auth library's user actually lands in storage** (e.g. an `oidc.user:` localStorage key) → reload +
  settle → `storageState`. oidc-client-ts defaults its user store to **`localStorage`** (captured by
  `storageState`), but confirm — if an app configures **`sessionStorage`**, `storageState` will NOT carry it
  and you must inject it via `addInitScript` instead.

## Navigate like a user (not like a script)

- **Use the product's real navigation.** Reach a page through its own nav/menu/search the way a user would
  (left-nav item; a "Search …" box → results → click the row), not by `page.goto` to a deep URL.
  **Page-hopping needs the user's approval** — maintain a short approved-exceptions list per project (e.g. a
  "start" page with no nav route). If a flow has no UI path, ask before hopping.
- **Pace for the eye.** Deliberate cursor travel to each target; don't rush because the automation can. We
  want a good video, not efficient movement.
- **Call `setStep` promptly** once a page/section is ready — a loaded-but-caption-less page is dead air.

## Show real interactions

- **Uploads:** even though the file is set on a hidden input headlessly, **move the cursor to the actual
  "choose a file / drop here" control first** so it reads as a real interaction, then set the input. After
  it lands, **capture the app's success toast** and (when the result lives somewhere) open that place — e.g.
  the documents folder — and show the file there. Note timing: if an upload is routed to a staging location
  first and only moved into its final destination by a later processing step, the destination only fills
  **after** that step — so show "it's there" *after* that step runs, not immediately.
- **Annotation stills:** ring the thing that changed (the new row, the uploaded file) and keep the success
  toast in frame; that's the beat the artifact still is captured from.

## Trigger plumbing off-camera

When the flow depends on a background job (and the job UI isn't the feature), put up an interstitial and
trigger the job from a **separate non-recorded** browser context / API call, then cut to the result. The
job dashboard never appears in the cut.
