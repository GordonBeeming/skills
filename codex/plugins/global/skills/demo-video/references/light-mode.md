# Light mode — fast, segment-driven recordings

The light production mode: one recording pass per video, driven by short scripts against the studio
core's recording layer, with blur chapter cards between sections and small callout overlays on the page.
No cover/agenda/end cards, no assembly concat, no bounded re-record loop. A light video is a polished
screen recording with step context, not a full production — turnaround is minutes, not hours.

Everything in the skill's shared production rules applies here too — real visible clicks, human pacing,
no dead air, overlays never spanning a navigation, the QA rules, the bug-signal rule.

## What a light video is made of

- **The studio recording layer** (`core/studio.mjs`): `launch` (1920×1080 headless context with the
  cursor + lower-third overlays injected), `setStep` for the persistent lower-third, `moveClick` for
  SSW-red glided-cursor clicks, `park`, `finish`. The lower-third is the step-context mechanism — it
  survives navigation because `launch` re-injects it via `addInitScript` on every load.
- **Blur chapter cards** as section transitions: a full-screen overlay that blurs the page behind a
  titled card. Playwright's screencast API provides one (`page.screencast.showChapter(title,
  { description, duration })`) when recording through Playwright's own CLI-driven surface (including
  siding guest mode); when recording through the studio core,
  render the same effect with a one-shot overlay (below). Either way: **the card's full duration must
  elapse, plus a buffer, before the next click or navigation** — see the gotcha section.
- **Inline callout overlays**: small positioned boxes ringing an element or holding a one-line note
  (`page.screencast.showOverlay(html, { duration })`, or an evaluated `<div>` with **inline styles
  only** — no injected stylesheets, so a partial teardown can't strip the styling). Position from the
  target's `boundingBox()`. Await the full duration before moving on.
- **Segments**: one webm per user-flow chunk. Between segments the driver (you) can do host-side work —
  fetch a one-time code, compute a TOTP, reset state — and then continue. Anything the viewer would
  wonder about ("how did that state change?") either stays out of light mode's scope or gets a chapter
  card explaining it.

## Recording

Same guest-mode rule as full mode (`recording.md`): **record where the app runs.** For an app in a
shunt siding, copy the runner + `config.mjs` to the siding's standing output directory (mounted at
`/out` in the guest) and run it there (`shunt-dev run <siding> node /out/demo/<runner>.mjs`); the core
is imported from the copied path. Recordings land back under that same directory on the host.

Auth in light mode: logins **may** stay on camera when they're part of the story (e.g. the feature being
demoed involves the sign-in flow itself, or the audience benefits from seeing it). When they're not part
of the story, cut them exactly like full mode (`saveAuth` → `storageState`).

Two-factor prompts during a recorded login:

- **Emailed one-time codes**: a local dev mail sink (an smtp4dev-style container) usually exposes an HTTP
  API — fetch the newest message for the user and extract the code between segments, then type it with
  `pressSequentially` as a real input. Dev 2FA codes are often **deterministic within their expiry
  window** (a resend returns the same code) — lean on that for retakes.
- **Authenticator (TOTP) codes**: read the manual setup key from the enrolment page's DOM, compute the
  code yourself (RFC 6238 is ~20 lines in any language; node's `crypto` does the HMAC), and type it.
  Target the key's actual element — a text-wide regex will happily match prose (four-letter words are
  valid base32) or a CSS hex colour from the page.
- Failed/malformed submits count as real failed attempts — enough of them **locks the account out**, and
  the mail-sink codes expire. Script the login carefully and keep the account-unlock reset handy.

## The overlay/navigation gotcha (why rule 4 exists)

A chapter card or callout injected into the live page is torn down by navigation — but not cleanly: the
overlay's *content* can be re-rendered without its styling after the load, leaving the card's raw text
painted at the top-left of the frame for the rest of the segment. This is invisible at thumbnail scale
and glaring at full size. Prevention:

- After showing a chapter/callout with duration N, `waitForTimeout(N + ~300ms)` before ANY click,
  `goto`, or form submit.
- Prefer the lower-third (`setStep`) for anything that must persist across navigation — it is re-injected
  per-load by design.
- Prefer inline-styled overlay elements over stylesheet-dependent ones, so even a partial teardown can't
  produce unstyled text.

## Build (host-side)

The guest records webm; convert on the **host** at the recording's native frame rate — never resample:

```
ffmpeg -i <rec>.webm -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -vf "setsar=1" -aspect 16:9 -movflags +faststart <rec>.mp4
```

Multiple segments for one video usually just play as one recording (record them into a single context);
if genuinely separate files need joining, use `assemble.mjs`'s `concat` from the core.

## QA — the frame-sample pass

Light mode's QA replaces the bounded re-record loop with one rigorous pass, gated by shared rule 9:

1. Probe duration, then extract frames at a fixed interval (`-vf fps=1/8` is a good default) plus the
   first and last seconds.
2. **View them at full size** — not the thumbnail grid. Check every frame for: unexplained text or
   elements (the overlay-remnant signature is raw text at the top-left), clipped/misaligned UI, wrong
   data on screen, dead frames.
3. Anything unexplained is a defect until root-caused. A finding means fix the script (or the product —
   rule 10) and re-record that video; light mode's re-records are cheap, so there's no excuse to ship one.
4. **Before recording at all**: take stills of every distinct screen the storyboard touches and review
   them the same way. A UI defect caught in a still costs one fix; caught in a finished video it costs a
   re-record.

## Artifact

Same principles as `artifact.md`, lighter build: one branded page (brand tokens via `brand-guidelines`,
dual-logo lockup for customer work) with each video embedded (`<video controls preload="metadata">`),
a two-or-three-sentence description per video saying what it proves, and a link to the change under
review. Copy the videos into the artifact folder — never reference them from a temp/output dir that a
container rebuild can wipe. Run the standard artifact visual-QA loop before handing back.
