---
name: video-qa
description: >
  QA technical product-demo and software-walkthrough MP4s against an intended storyboard and return a
  timestamped issue list. Use for screen-recorded UI demos and walkthroughs that need checks for scripted
  beats, navigation flow, loading or error states, title cards, dead air, hard cuts, on-screen data,
  branding, and ship readiness. Always runs the deterministic probe, then hands analysis to a fresh teammate.
---

# video-qa

Critique a demo MP4 against its intended storyboard and return the timestamped
checklist a sharp human reviewer would write. Two layers: a **deterministic probe**
(ffmpeg/ffprobe/node — mechanical detection, no model reasoning) and a **fresh
analysis subagent** that reasons over the probe's compact JSON report + a bounded
set of extracted frames against the script.

## Hard rule: the analysis ALWAYS runs in a fresh subagent

The caller (you, in the main thread) does the **minimum**:

1. Locate the inputs.
2. Run the probe script.
3. Spawn a fresh independent subagent (the `Agent` tool) to do the analysis.
4. Relay the subagent's issue list back to the user.

**Never read the extracted frames or reason over the report yourself in the caller
thread.** The whole point is token isolation: a 5-minute video produces ~50 frames
and a large JSON report; reasoning over them costs tens of thousands of tokens of
images + analysis. If that lands in the caller's context it poisons the rest of the
session. The subagent absorbs it and returns only the short issue list. This is not
optional or a "when convenient" — every `video-qa` invocation hands off. See
`references/handoff.md`.

## Step 1 — Gather inputs

You need:

- **Video path** — the MP4 to QA (the assembled/final cut a reviewer would watch).
- **Storyboard / script** — the intended beats in order, timing expectations, and
  what each segment should show. If the user hasn't given one, ask for it (or for
  the issue or `demo-video` storyboard it came from). Do not invent beats.
- **Expected cards** — the scripted cards (cover, agenda, each interstitial, recap)
  in order. Write them to a small JSON file for `--cards-file`: an array of
  `{ "label": "Cover (title + subtitle)" }` entries (add `"minRead": <sec>` to
  override the read-time bar for a wordier card). This drives the deterministic
  card cross-check — a first-class output, since cards are authored narration.
- **Branding** — card/background colours and cursor/annotation colours, so the
  probe can classify brand cards and the subagent can check contrast. Defaults if
  unspecified: ask; don't guess a brand.

## Step 2 — Run the deterministic probe

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/video-qa/scripts/probe.mjs \
  --video "<absolute/path/to/video.mp4>" \
  --out   "<workdir>/video-qa-report.json" \
  --frames-dir "<workdir>/video-qa-frames" \
  --card-rgb 57,64,245 \          # the brand card colour as R,G,B (e.g. #3940F5)
  --cards-file "<workdir>/cards.json"   # the expected storyboard cards, in order
```

Use a scratch/temp `<workdir>` (e.g. under `/tmp`), not the user's repo. The probe
writes the JSON report and the bounded frame set, and prints the report path. It
runs three full-video filter passes (freeze, scene-cut, motion) plus per-scene
sampling — budget ~1–1.5× the video's wall-clock duration. Tunables (all optional,
sensible defaults baked in): `--card-tol`, `--demo-freeze`, `--annot-freeze`,
`--card-min-read` (read-time bar, 2.5s), and `--annotate-rgb R,G,B` — the annotation
call-out colour. When given, a dead-air region holding a "look here" annotation ring
in that colour is treated as intentional pacing (`annotated: true`) and kept out of
the headline dead-air count rather than flagged as a defect. See
`references/detectors.md` for what each detector measures and why the thresholds are
set where they are.

**Annotation detection is scoped to dead-air regions, so `annotatedRegionCount: 0`
does NOT mean "no annotations in the video".** A ring only registers when it coincides
with a held/frozen span; if the build trims dead air (or the ring plays over motion),
the ring still renders on screen but no dead-air region carries it — the count is 0 by
construction. Never report annotations as missing from that number alone; if a beat is
scripted to ring something, confirm it from that segment's frames (the per-scene
`span-*` frame, or pull the frame at the annotation's timestamp).

Sanity-check the printed summary (span count, dead-air regions, glitch count, frame
count, and `cardCheck.countMatches`) before handing off. If `cardSpans` is 0 the
`--card-rgb` is probably wrong — fix it and re-run, otherwise every card reads as
`ui` and the freeze/dead-air/card classification is meaningless. If `cardCheck`
shows a count mismatch, that's a real finding (a missing or extra card), not a probe
error — let the subagent confirm it against the frames.

## Step 3 — Hand off to the analysis subagent

Spawn a fresh subagent with the `Agent` tool (`subagent_type: general-purpose`).
Build its prompt from `references/analysis-prompt.md`, substituting:

- `{{REPORT_PATH}}` → the `--out` path from step 2.
- `{{FRAMES_DIR}}` → the `--frames-dir` path.
- `{{OUT_FINDINGS}}` → a findings file path you'll read (e.g. `<workdir>/video-qa-findings.md`).
- `{{STORYBOARD}}` → the intended beats from step 1, verbatim.
- `{{BRANDING}}` → the branding rules from step 1.

Tell the subagent — **as an explicit instruction in its initial prompt** — to **WRITE
its findings to `{{OUT_FINDINGS}}`** as the last step of its turn. Reading that file is
the reliable retrieval path: a spawned agent's final text message is not always
delivered to the caller, and follow-up "send me your findings" pings frequently land on
an idle agent that won't re-engage. The file holds only the issue list (no frames), so
it doesn't break token isolation. The subagent still reads the report + frames and
reasons beat-by-beat; it just persists the result where you can read it.

## Step 4 — Relay

**Read the findings file** (`{{OUT_FINDINGS}}`) and pass the issue list back to the user
as-is (it's already the deliverable format). Add nothing from your own reasoning about the
frames — you never looked at them, by design. If the user wants it as a branded HTML
artifact, that's a separate
follow-up.

**Spot-check "could-not-determine" items before treating them as defects.** The probe samples
a bounded set of frames (tens, not every frame), so a beat that genuinely happened can fall
*between* samples and come back as "could-not-determine" or a "looks page-hopped / not shown"
flag — a sampling gap, not a real absence. These are the cheapest findings to be wrong about.
For each such item, pull the few frames at the exact timestamp it *should* occur (e.g.
`ffmpeg -ss <t> -i video.mp4 -frames:v 1 …`) and confirm directly before reporting it as a
defect. Report only what the full video actually lacks; downgrade confirmed-present beats to
✅ with a note that it was verified outside the sampled set.

## What it catches (and what it can't)

- **Reliable, mechanical:** dead air / frozen UI regions (motion-density scan),
  scene/segment structure, brand-card vs UI classification, glitch clusters (stray
  refresh / page-hop flicker), gross contrast/luma stats.
- **Subagent reasoning over bounded frames:** off-script plumbing UI (admin
  dashboards, logs, error traces) — including *brief* login/loading/empty/admin
  flashes between beats and mid-segment reloads, which are treated as polish
  defects, not acceptable transitions; **over-editing / hard cuts** (the dead-air
  trim chopped real motion — cursor teleporting with no travel, a page transition
  snapped to a hard jump, a cut mid-action) which read as fake; missing/wrong beats;
  navigation style as a first-class check (browsed-through-the-product vs page-hop into a deep page);
  cards judged for whether they *land* (legible duration, not undercut by a
  contradicting/empty neighbour) rather than presence alone, with cover vs agenda
  cards distinguished by content; wrong on-screen data (counts, broken rows);
  missing annotations; branding/contrast traps.
- **Blind spots:** a missing on-screen *caption* during an otherwise-active region
  (loading animation reads as motion), and whether an action genuinely failed vs
  was edited out of frame. The subagent surfaces these as "could not determine".

`references/validation-notes.md` records how the skill scored against the reference
fixture's human-reviewed golden list.
