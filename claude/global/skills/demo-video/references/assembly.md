# Assembly

`scripts/assemble.mjs` stitches the cards + recording into the final MP4 with ffmpeg.

## API

- `imageClip(png, dur, out)` — a still image held for `dur` seconds (used for every card).
- `videoClip(webm, out, speed?)` — normalise a recording to MP4. With no `speed`, real-time (and padded
  to 1920×1080 if needed). With `speed = { from, to, factor }`, the `[from,to]` second span is sped by
  `factor` (trim/setpts/concat).
- `concat(segs, out)` — concatenate the clips in order into the final file.

A typical `buildN.mjs`: `renderCards([...])` → `imageClip` each card → `videoClip` the recording →
`concat([cover, agenda, (interstitial), recording, end], final)`. Poster frame:
`ffmpeg -ss 2 -i final.mp4 -frames:v 1 poster.png`.

## Quality settings (the resolution fix)

Intermediates use CRF 14 + `keyint=60`; the final concat uses CRF 16 + `preset slow` + `yuv420p`. Screen
text on a near-static background needs this low CRF — higher CRF (e.g. 23) starves the bitrate and the
text smears (the artifacting that prompted the fix). The final concat also applies `setsar=1` and
`-aspect 16:9` so players don't open the file at the wrong size. Don't loosen these without re-checking
sharpness on a text-heavy frame.

## Build at the recording's NATIVE frame rate — never resample (this judders)

Playwright's `recordVideo` does **not** emit 30fps — on this setup it's **~25fps** (check:
`ffprobe -select_streams v:0 -show_entries stream=avg_frame_rate <rec>.webm`). If the build re-encodes to a
different rate (the old pipeline hard-coded `fps=30` and `setpts=N/30/TB` everywhere), two bugs result:

- **Judder/"stuttering".** Converting 25→30 duplicates one frame in every five. On smooth cursor travel or a
  scroll over a high-contrast static page (e.g. a sticky header + list) that regular hitch reads as a stutter —
  and it's nearly impossible to spot in a still, only in playback. It looks like a "broken scroll".
- **Wrong speed.** `setpts=N/<target>/TB` relabels frames by index, so a 25fps source forced into 30fps slots
  plays ~1.2× too fast (motion looks rushed) on top of the judder.

**Fix: detect the source fps once and thread it through the whole build** so nothing resamples. `assemble.mjs`
exposes `probeFps(file)`; the build does `const FPS = probeFps(rec-A.webm)` and passes it to
`trimDeadAir(…, { fps: FPS })`, `imageClip(png, dur, out, FPS)`, and renders every card at `FPS` too — so the
final `concat` sees one uniform rate and never duplicates a frame. Verify after building: output
`r_frame_rate` matches the source, and a motion span has **0 duplicate consecutive frames**
(`ffmpeg -i out.mp4 -an -f framemd5 -` over the span → no two adjacent hashes equal). Diagnose suspected
stutter by **measuring**, not eyeballing stills: per-frame difference
(`tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG`) reveals a
dup-frame judder as a regular 0 / spike alternation; a clean motion span ramps smoothly.

## webm duration is unreliable — do NOT calibrate speed-ups off it

Playwright's `recordVideo` webm reports a wrong/variable duration via `ffprobe`. A `videoClip` `speed`
span calibrated against that reported length will speed the wrong section (this bit us: a span tuned for
one recording sped a different part of the next). Rules:

- **Prefer real-time** (`videoClip(webm, out)` with no `speed`). Keep in-script waits short instead of
  recording long pauses and speeding them up.
- If you genuinely must speed a span, re-measure it against the *actual* recording by extracting frames
  (`ffmpeg -ss T -i rec.webm -frames:v 1 f.png`) and finding the real start/end of the slow part — don't
  reuse a previous video's numbers.

## No drawtext

This ffmpeg has no `drawtext`/freetype filter. All text-on-video comes from the HTML→PNG cards. Don't
attempt `drawtext`; it errors with "Filter not found".

## Auto-trim dead air (mandatory) — and ONLY dead air

The goal is **continuous browsing**, not a heavily-edited reel of hard cuts. Over-trimming is worse than
a slightly-long pause: if the trim cuts the frames where the cursor is travelling to a button, or the
moment one screen transitions to the next, the video becomes "hard cut → hard cut → hard cut" and reads as
fake/over-edited. So the trim must cut **only** genuine dead air and nothing else.

**Definition of dead air (the whole spec):** a run of **pixel-for-pixel identical frames** with **no
annotation** on screen. That's it. A page-load/transition is *not* dead air (the pixels are changing as it
paints), and a cursor glide is *not* dead air (the rendered cursor moves, so consecutive frames differ).
Both must play through untouched. Up to ~**0.5s** of identical frames is fine; beyond that, drop frames
until the pixels change again.

**How `trimDeadAir` implements it** (don't reach for `freezedetect` — its MSE can't see a small moving
cursor against a static page, which is exactly what caused the over-trim):

- It hashes every frame (`ffmpeg … -f framemd5`) and finds runs of **identical** consecutive hashes ≥
  `minRunSec` (0.5s). A moving cursor or a loading page changes the hash every frame, so those runs never
  form — glides and transitions are never cut.
- Each over-long static run is clamped to a `holdSec` (0.5s) head; the rest is dropped.
- **Annotation holds are kept in full.** A held "look here" ring is static (so it hashes as a run) but is
  intentional read-time pacing. Detecting the ring post-hoc is unreliable (the cursor shares the ring
  colour), so the **recorder declares** its hold ranges: `shot()` records each `[start,end]`, `finish()`
  writes a `<webm>.annot.json` sidecar, and the build passes it as `trimDeadAir(webm, out, { annot })`.
  Runs overlapping an annotation range are exempt.
- The near-white load-blank drop stays (removes page-load white).

**Record tight so there's little to trim.** After a page settles, start moving the cursor toward the next
target rather than parking and waiting — keep each segment a continuous browse. The trim is a safety net for
the unavoidable static waits, not a substitute for tight recording. This runs over every `seg-*.mp4` in the
build, not as a manual edit.

**On a LIGHT / white-background recording, pass `noBlankDrop: true`.** The trim's near-white load-blank drop
(`YAVG < blankYavg`, default 227) assumes a bright frame is a page-load blank. That holds for a dark/coloured
app UI, but a **white-background page** (a doc/reference walkthrough, a light-theme app) is bright *throughout*,
so the blank filter deletes the real content frames and the segment collapses to a few seconds — and
`holdSec` won't fix it because the blank drop runs *before* the hash-run clamp. Symptom: the built segment is
far shorter than the recording (`ffprobe` the webm's real length via frame count, not its unreliable duration
header) and raising `holdSec` changes nothing. Fix: `trimDeadAir(webm, out, { …, noBlankDrop: true })` so
only genuine pixel-identical over-holds are clamped. For an intentionally-paced **doc-scroll walkthrough**,
also raise `holdSec` (~2.5) so the reading beat after each scroll survives.
