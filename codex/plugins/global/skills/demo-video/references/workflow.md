# Workflow

The end-to-end spine for a silent demo-video set, from intake through recording, QA, and handoff.

## 0 · Gather the brief (project-agnostic intake)

Nothing here is tied to a particular app, and the specifics are never known up front — gather them per run. Don't
assume; **ask the user** for anything you can't determine from the repo/docs. Establish:

- **What to demo.** The feature and the exact flow(s) to show — in the user's words. If there's an
  issue/PBI/PR, read it. If it's ambiguous, ask (use the question tool). This becomes the storyboard and
  the agenda blurb.
- **Where.** The base URL / environment to record against, and confirm it's running and reachable.
- **Auth — or not.** Establish whether the environment requires sign-in:
  - **No auth** → skip `login()` entirely; the video script just navigates (`page.goto`).
  - **Auth required** → find the login method *before* recording. Look first at the repo / existing docs
    (READMEs, `CLAUDE.md`/`AGENTS.md`, dev-setup notes, seeded local creds). If you can't find it, **ask
    the user** for the URL, credentials, and any selector quirks. For SSO / MSAL / biometric walls the
    headless browser usually can't complete sign-in itself — ask the user to log in for you in the headed
    session, or arrange a Playwright `storageState` (see `recording.md`). Don't drive SSO headless.
- **How many videos.** One per coherent flow (the example uses two — "create the next period" and
  "the approval lifecycle"). Each video is its own cover/agenda/recording/end.

Then know what the feature is and why it exists in one or two sentences — that becomes the agenda blurb.

## 1 · Storyboard (per video) — APPROVAL GATE

Write, in a scratch note:

- **Agenda intro blurb** — one or two plain sentences: what was built, and what this video shows. Plain
  language, present tense, User's voice. Example: *"We've added a way to roll an account to its next
  renewal period straight from the list — one account at a time, or in bulk. This video walks through
  both."*
- **Steps** — each becomes a lower-third beat (`Step N · {short title}` + a one-line subtext). Keep
  titles short; the subtext carries the detail.
- **Stills** — which beats you'll capture with `shot()`, and what each one highlights.
- **Off-camera steps** — list every state change you'll make by hand between recorded beats (DB nudges,
  background jobs, role assignment, etc.). Each one MUST appear as a line on a "Behind the scenes"
  interstitial card (see step 4 + `cards.md`) so the viewer understands how the record changed state.

Show this to User and let him edit. **Do not record until he approves.** Seeing the storyboard is how
he confirms the flow matches intent.

## 2 · Get the app into demo state

A demo needs the data in a precise, repeatable state (an approvable record, a list with the right rows,
etc.). Script the setup so it can be re-run — see `app-state-setup.md`. Two realities to plan for:

- **Re-recording consumes state.** If a flow creates records (e.g. "create next year"), a second take
  needs those deletions/resets first. Capture the reset as a script (`reset.sql` in the example).
- **Background pipelines.** If readiness depends on a job/cron, trigger it deterministically rather than
  waiting (the example triggers a background job directly).

## 3 · Record

- `cp <skill-dir>/scripts/config.example.mjs config.mjs`; fill in brand + app values + the recording date.
- Write `videoN.mjs` importing the core from `<skill-dir>/scripts/studio.mjs`. If the env needs auth,
  call `login(page, LOGIN)` first (override its selectors if the form differs); if not, skip it and go
  straight to `page.goto`. Pattern per step: `setStep(...)` then `moveClick(...)` for each interaction;
  `shot(...)` at still beats; `park(...)` to settle the cursor before a final frame. Re-call `setStep`
  after any full navigation.
- Run it; it writes `vid/rec{N}.webm` and the stills to `vid/shots/`.

## 4 · Build

- Write `buildN.mjs`: `renderCards([...])` for the cards (cover/agenda(+blurb)/[interstitial]/end), then
  `imageClip` each card, `videoClip` the recording, `concat` them in order. See `assembly.md`.
- **If there were off-camera steps (step 0/2), the interstitial is not optional** — render it AND include its
  `imageClip` in the `concat` list, positioned right before the recorded section it sets up. Double-check the
  concat array actually contains the interstitial clip (it's easy to render the card but forget to concat it —
  the symptom is exactly "the behind-the-scenes page isn't in the video").
- Poster = a cover frame (`ffmpeg -ss 2 -i video.mp4 -frames:v 1 poster.png`).

## 5 · QA loops (mandatory)

Run every loop in `qa-loops.md`. Re-build/re-record until clean. Don't sign off from a thumbnail.

## 6 · Artifact

Build/update the HTML artifact per `artifact.md`: videos with posters, the stills, a written
walkthrough whose captions match the stills exactly. Run the artifact visual-QA loop.

## 7 · Humanizer

Run the `humanizer` skill over every piece of human-facing prose — the agenda blurb, every caption, the
artifact copy — and fix matches. Mandatory per the global content rule; re-run on any later prose edit.

## Re-record checklist

When you re-do a video: reset consumed state → re-record (re-captures stills) → rebuild → re-copy videos
+ posters + stills to the artifact → confirm captions still match the new stills → re-QA.
