---
name: demo-video
description: >
  Record branded demo videos of a web-UI feature with Playwright, plus a shareable HTML artifact. Asks
  whether to produce a light cut (fast screencast with blur chapter cards and callout overlays) or a full
  production (cover/agenda cards, lower-thirds, glided cursor, bounded QA loop). Use for feature demos,
  proof-of-work videos, walkthrough recordings, and before/after UI videos — including apps running in a
  shunt siding (records in-guest). Triggers: "demo video", "record a demo", "proof video", "walkthrough
  video", "show the feature working on video".
---

# demo-video

**This skill improves as you use it.** When a recording surfaces a problem, or you discover a better
technique / a wrong assumption / a new gotcha, **update this skill (and any per-app `navigate-<app>` skill)
so the process keeps getting better.** Minor corrections and added learnings: just make them. Major changes
to the approach: confirm first. Everything below is the current best understanding, not the final word.

**Keep the skill (and its `scripts/` core) 100% GENERIC — never put specific-implementation information into
it.** No app names, brand colours, URLs, ports, IDs, selectors/class names, passwords, or domain words ever
go into this skill or the core scripts. The core functions describe *mechanisms* ("real-click an ordered
path", "try a list of credential attempts until one works"); the caller passes the specifics. All
specifics — selectors, credentials, click sequences, the brand `CFG`, domain terms — live in the
**per-project version under the artifacts folder** (and in the per-app `navigate-<app>` skills for nav
knowledge), never here. When you learn something while building one demo, generalise it before it lands in
the skill.

Records branded demo videos of a **web-UI feature** with Playwright, plus a shareable HTML artifact. No
webcam. Two production modes share one spine (brief → storyboard approval → state setup → record → QA →
artifact); how much production goes into the recording is the mode choice.

## Pick the production effort — ask, don't assume

Unless the user already said which they want, **ask with the question tool** at intake:

- **Light** — one segment-driven recording pass, fast turnaround. The studio core's recording layer
  (`launch` + `setStep` lower-thirds + `moveClick` cursor) driven by a single quick script, garnished with
  the screencast-style **blur chapter cards** between sections and small **inline-styled callout overlays**
  on the page. No cover/agenda/end cards, no assembly pipeline, no bounded re-record loop — a frame-sample
  QA pass instead. Logins may stay on camera when they're part of the story. See
  `references/light-mode.md`.
- **Full** — the complete production pipeline: cover → agenda → recording → end recap, persistent
  lower-thirds, glided cursor, off-camera logins via `storageState`, "behind the scenes" interstitials for
  off-camera state changes, mid-recording annotated stills, and the bounded `video-qa` re-record loop. See
  `references/workflow.md`.

Both modes are **silent.** The visual flow carries the story.

This skill is for **web** UIs driven through a real browser. For desktop apps driven by an MCP, read
`references/adapting-drivers.md` first — most of this skill is reusable, but the driver layer changes.

In every command below, `<skill-dir>` is this skill's own directory (the runtime substitutes it).
For non-trivial work — e.g. building and QA'ing several independent videos in the same run — hand the
heavy phases to a small agent team per the global agents rule. A single video's whole pipeline is
usually a one-agent job; don't split it across several just because a team is available. The
**approval gate** (the storyboard) always happens in the main thread with User.

## Brand rules (both modes)

- Cards, chapter cards, and lower-third accent → the **brand accent**, resolved by the `brand-guidelines`
  skill (see its `references/routing.md`). Don't hardcode a colour here — defer to that skill so the demo
  matches every other artifact for the project.
- **Cursor + annotation boxes + callout rings are ALWAYS SSW red `#CC4141`, for every brand including the
  personal one.** A consistent red pointer/ring reads clearly on any UI and is never mistaken for the
  product's own accent.
- Footer on full-mode cards: presenter (left) · `Demo · {env}` (centre) · date (right).

## Production rules (shared — this is what separates a good demo from scripted automation)

We're making **good product videos**, not efficient automation. Optimise for how the video reads.

1. **Every interaction is a real, VISIBLE user input — never fake or manipulate the page directly.**
   - **Clicks:** the real actionable click on the real element (`moveClick` → `locator.click()`). **No**
     `page.goto` to skip to a page a user reaches by clicking, **no** synthetic `el.click()` via
     `evaluate`, **no** blind coordinate clicks. The only acceptable `goto` is opening the app at its base
     URL to start a session (or a segment's own starting screen).
   - **Scrolls:** visible mouse-wheel scrolling at a brisk human pace; never `scrollIntoView` jumps.
   - **Interception is a state problem, not a reason to bypass** — fix the UI state, then click for real.
   - **No "search then teleport"**, and no redundant navigation to a screen you're already on.
   - Capture per-app navigation knowledge in a `navigate-<app>` skill and keep it current.
2. **Pace like a human.** Deliberate cursor travel; let the eye keep up.
3. **No dead air.** Demo-segment freezes ≤ 250–500 ms; hold ≤ 1–2 s only while an annotation is read.
   Cards can hold longer.
4. **Overlays never span a navigation.** A chapter card or callout must fully finish (its duration elapsed,
   plus a small buffer) before any click or navigation fires. One-shot overlays injected into the page lose
   their styling across a load and re-render as raw text stuck at the top-left — the studio's lower-third
   is immune (re-injected via `addInitScript` on every navigation), which is why step context always comes
   from `setStep`, not from a long-lived ad-hoc overlay.
5. **Don't show internal plumbing** (job dashboards, DB tools, infra). Trigger it off-camera and show the
   *result*; in full mode the "behind the scenes" interstitial explains it. Exception: the plumbing IS the
   feature.
6. **Show real interactions visually** — cursor to the real control, capture the success toast, open the
   place a result landed.
7. **Mirror the app when staging data.** Direct DB staging must set every field the real action sets, or
   the UI renders a broken half-state. Check the service/handler code for companion writes (audit-stamp
   tokens, timestamps, approver ids — often under a different provider/table than the obvious one), then
   open the screen and confirm it looks exactly like the real thing.
8. **Reset hygiene between takes.** Script the reset (SQL/API) and clear *all* consumed state — rows,
   mappings, flags, files — or leftovers leak into the recording. See `references/app-state-setup.md`.
9. **Cut glitches; QA is a loop, not a glance.** In **any** QA pass — full mode's bounded `video-qa` loop
   or light mode's frame samples — **any unexplained text, element, or pixel in a frame is a defect until
   root-caused.** "Probably a transient animation" is not a root cause; it's the exact dismissal that lets
   a broken cut ship. Full mode's loop and caps: `references/qa-loops.md` §7. Layout balance is part of
   this check, not just stray content: a content block hugging one edge with a large empty gutter on the
   other side reads as harmless whitespace at a glance but is usually a centering/width defect — compare
   the left and right gaps around the main content block on sampled frames, and treat asymmetry as a
   defect until root-caused just like an unexplained pixel.
10. **A user-path that doesn't work is a bug signal — investigate it, don't route around it.** A record
    that won't appear, an action that 404s, a misaligned control: that's product feedback the demo just
    earned. Stop, read the code, fix or surface it with the root cause. Papering over it with a deep-link
    or DB poke makes the demo a lie. The demo's QA pass doubles as UI QA — stills of every screen the video
    touches, reviewed properly, catch real product defects before the recording bakes them in.

Full-mode-only rules (login cuts via `storageState`, interstitials, still capture mid-recording, the cut
cap) live in `references/workflow.md` and `references/recording.md`.

## Prerequisites

- Playwright installed and resolvable (the scripts `require` it plainly first, falling back to a fixed
  host path — see `references/recording.md` if that fallback needs fixing).
- `ffmpeg` on PATH **on the host**. This build has no `drawtext`/freetype — text-on-video comes in as
  HTML→PNG cards; don't reach for `drawtext`.
- The target app running and reachable. **Record where the app runs** — an app in an isolated dev
  container (a shunt siding) records **in-guest**; see the guest-mode section of
  `references/recording.md` (it applies to both modes).

## Working directory — versioned, in the artifacts folder (NOT temp)

Both modes work **inside the artifact folder, versioned** — never a throwaway `/tmp` dir. Layout:

```
<artifacts>/<project>/<feature-slug>/
  index.html, archive/vN.mp4, img/        # the deliverable (see references/artifact.md)
  versions/
    v1/  core -> <this skill's scripts/>  # symlink to the canonical reusable core (no copy, no drift)
         record-all.mjs build-all.mjs config.mjs reset/ cards.json …   # this version's scripts
         vid/  (recordings, seg mp4s, stills, qa/findings.md, the cut)
    v2/  (copy v1 forward, then edit)
```

- **The reusable core (`studio.mjs`, `cards.mjs`, `assemble.mjs`) is symlinked in as `core/`** —
  `ln -sfn <skill>/scripts <version>/core`. One canonical core, never copied.
- **Each new cut = a new `vN/` folder** (`cp -r` the previous, then edit) so any cut is reproducible.

## Core vs app-specific wrappers (build reusable, not one-offs)

- **Core functions live in `scripts/studio.mjs` (+ `cards.mjs`/`assemble.mjs`) and are GENERIC** — the
  movability/interaction primitives: `slowMoveTo`, `scrollTo`, `moveClick`, `isClickable`, `navPath`,
  `setStep`, `shot`, `park`, `launch`/`login`/`saveAuth`/`finish`.
- **App-specific wrappers supply the specifics** (selectors, click sequences, conditions) and call the
  core. They live with the recording script / the per-app `navigate-<app>` skill, never in the core.
- **A new technique goes into the generic core first**, then gets a thin app wrapper. Refactor one-offs
  into this shape so the toolkit compounds.

## Workflow

The shared spine (details in `references/workflow.md`; light mode's deltas in
`references/light-mode.md`):

0. **Gather the brief** — what to demo (read the issue/PR), where (base URL/env, confirm it's up), auth
   (repo docs/seeded creds, or ask; never drive SSO headless), how many videos, **and which production
   mode** (ask — see above).
1. **Storyboard per video — APPROVAL GATE.** Agenda blurb, steps (each a lower-third beat), stills list,
   off-camera steps. Show User; **do not record until he approves.** Both modes.
2. **Get the app into demo state** (`references/app-state-setup.md`) — scripted, resettable.
3. **Record** — full: `references/recording.md`; light: `references/light-mode.md`.
4. **Build** — full: `references/assembly.md` (cards + concat); light: usually just the host-side
   webm→mp4 conversion.
5. **QA loops** — full: `references/qa-loops.md` (bounded re-record loop); light: the frame-sample pass in
   `references/light-mode.md`, under shared rule 9.
6. **Artifact** (`references/artifact.md`) — embed videos with posters, stills, written walkthrough, then
   the mandatory artifact visual-QA loop.
7. **Humanizer pass** on every piece of human-facing prose — mandatory per the global content rule.

## Reusable scripts (`scripts/`)

- `studio.mjs` — recorder core: `launch / login / saveAuth / pause / setStep / moveClick / park / shot /
  finish`. Carries no app constants; takes a CFG. Annotation colour defaults to `cfg.annotate` (SSW red).
- `cards.mjs` — `cover / agenda({intro,steps}) / interstitial / end` + `renderCards` (full mode).
- `assemble.mjs` — `imageClip / videoClip / concat` with the crisp ffmpeg settings (full mode).
- `config.example.mjs` — the CFG template.

## Worked example

`examples/acme-renewals/` is a complete fictional two-video **full-mode** demo — adapt it rather than
starting from scratch. Light mode's worked shape is inside `references/light-mode.md`.

## References

- `references/light-mode.md` — the light production mode end to end.
- `references/workflow.md` — the full-mode process + the approval gate.
- `references/recording.md` — studio API, overlays, guest-mode (shunt siding) recording, auth note.
- `references/cards.md` — card types, the agenda blurb, the off-camera interstitial (full mode).
- `references/assembly.md` — ffmpeg quality settings, native-fps rule, dead-air trim.
- `references/qa-loops.md` — the bounded QA loops + cross-still consistency.
- `references/artifact.md` — HTML artifact structure, posters, captions, keep-it-current rule.
- `references/app-state-setup.md` — getting the app into demo state.
- `references/adapting-drivers.md` — Playwright vs MCP-driven apps.

## Not yet covered

- **MCP-driven desktop apps** — assessed in `references/adapting-drivers.md`; likely a sibling skill.
