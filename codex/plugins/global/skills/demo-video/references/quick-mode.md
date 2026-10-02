# Quick mode: record the real browser while you drive it

No Playwright script. You drive the browser live and macOS records the window. Right for before/after
evidence, a quick proof clip, or anything where writing a script would take longer than doing the thing.

## Steps

1. Pick the driver: `profile.evidence.driver` when running under `/work` (`chrome` = Chrome extension
   tools on the real browser; `computer-use` = desktop Computer Use, for anything that is not a browser
   tab; `playwright` = the headless Playwright MCP browser). Outside `/work`, ask once. Open the app with it. Get the screen to
   the starting state. Size the window to the first entry of `profile.evidence.viewports` (1920×1080 unless the profile says otherwise); a demo video is 1920×1080.
2. Start recording the window:
   ```
   <skill-dir>/scripts/screen-record.sh start <run dir>/evidence/before-<flow>.mp4 --app "Google Chrome"
   ```
   `--app` reads the front window's bounds; `--rect x,y,w,h` or `--screen` when that doesn't fit.
   `--max <seconds>` caps the take.
3. Annotate as you go. Quick is not a bare screencast: every section gets a lower-third naming it, and the
   element being shown gets a callout. In a browser driver, inject them into the live page before the take
   with the browser's JavaScript evaluate tool: `setStep` from `scripts/studio.mjs` for the lower-third, the inline
   callout snippet from `references/light-mode.md` for the callout. With `computer-use`, note the
   timestamps and add them after with `cards.callout` + `assemble.overlayClip`.
4. Drive the flow with the browser tools: click, type, scroll, at a human pace (a short pause after each
   action reads better than a burst). Update the lower-third when the section changes.
5. Stop; the helper writes the MP4:
   ```
   <skill-dir>/scripts/screen-record.sh stop <run dir>/evidence/before-<flow>.mp4
   ```
6. Repeat for the after take with the same window size and the same steps, so the two cuts line up.
7. Watch both files once (frame-sample QA from `references/qa-loops.md`, the light version): the start
   state is visible, every action is visible, nothing sensitive is on screen, the end state is visible.

## Rules

- Same window size, same starting state, same order of actions for before and after.
- No section without a lower-third; no highlighted element without a callout. A take that skipped them is
  re-recorded, not shipped.
- No logins on camera unless the login is the story; do it before `start`.
- Anything behind a login is driven by Codex, not Claude: Claude will not type a password into a login
  field by any route (a model boundary, not a setting). See `references/codex-take.md`: write the take
  brief, run it through `codex-run.sh --mode build`, QA the MP4 that comes back. `devLogin` false or
  credentials not documented: stop and ask User to sign in.
- If the browser tools can't reach the screen (data, access, environment), stop and ask for it. Don't
  fake a take.
- First run asks macOS for Screen Recording permission for the terminal app; grant it once.
- Output is always MP4 (H.264). The raw `.mov` is deleted after conversion; `--keep-mov` keeps it.

## Edits still apply

A quick recording is just an MP4, so the same post-production works on it:

- **Cards** (cover, agenda, interstitial, end): `cards.renderCards` then `assemble.imageClip` and
  `assemble.concat`, exactly as light and full mode do.
- **Dead-air trim and speed-ups**: `assemble.trimDeadAir` and `assemble.videoClip` on the MP4. Pass an
  `annot` list of `[start, end]` seconds for the moments you want kept (note the timestamps while you
  drive; `screen-record.sh` prints the start time).
- **Callouts and lower-thirds**, two ways:
  - Browser drivers (`chrome`, `playwright`): inject the studio's overlay in the live page before the
    take with the driver's JavaScript tool: the lower-third is `setStep` in `scripts/studio.mjs`, the
    inline callout overlay is the snippet in `references/light-mode.md`. Both then get recorded as part
    of the screen.
  - Anything else (`computer-use`): render a transparent callout with `cards.callout` and composite it
    with `assemble.overlayClip(mp4, png, out, { from, to, x, y })`.
- Frame rate: screencapture records at 60 fps. `probeFps` reads it, so build at the source rate; never
  resample to 25 or 30 (it judders).

## When to step up

Chapter cards, callouts, or a cursor glide: use Light. A narrated multi-section walkthrough with cover,
agenda, and recap: use Full. Both are in `references/light-mode.md` and `references/workflow.md`.
