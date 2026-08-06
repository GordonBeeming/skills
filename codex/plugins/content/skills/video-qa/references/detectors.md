# Detectors and thresholds

The probe (`scripts/probe.mjs`) runs four mechanical detectors and a frame
sampler. Everything below is what each measures, the threshold it uses, and why
that threshold — tuned against the reference fixture (a 5:21 1920x1080 screen
recording of a product walkthrough). Numbers in the report are ground truth for
the analysis subagent; it does not re-measure.

## 1. Metadata (`ffprobe`)
Duration, resolution, SAR/DAR, fps, pixel format, codec, size, bitrate. Used for
the report header and to bound the scan. No thresholds.

## 2. Scene/segment structure (`scdet` + brand-colour classify)
`scdet=threshold=6` lists scene-change times. Threshold 6 (out of 100) is
deliberately sensitive: it catches both real beat boundaries and the 2-4 cut
clusters a cross-dissolve between cards produces, which we need for the glitch
heuristic. The cut times bound the video into spans; each span's midpoint frame is
downscaled to 1x1 and its average RGB compared to `--card-rgb` within `--card-tol`
(default 45 per channel). A match = a solid-colour brand "card" (intro/interstitial
/recap); otherwise "ui" (live product screen).

Why 1x1 average: a brand card is a near-uniform fill, so its mean colour IS the
card colour; a UI screen averages to near-white/grey. On the fixture, cards land at
RGB ~(60,67,246) against the brand-colour target (57,64,245); UI screens average
~(244,244,244). The tolerance comfortably separates them. This classification is
load-bearing: freezes and dead air on cards are expected (cards are static), on UI
they are defects.

## 3. Dead air — windowed motion density (`mpdecimate`, single pass)
The primary still-frame detector. One `mpdecimate,showinfo` pass over the whole
video yields the timestamp of every frame that visibly differs from its
predecessor. JS buckets those timestamps into fixed 6s windows -> unique frames per
second per window. A `ui` window below `2.0/s` is dead air; contiguous low windows
merge into a region, and regions >=4s are reported.

Why motion density and not freezedetect as the primary signal: on a screen
recording the cursor sits still between actions, so `freezedetect` fires on almost
every stretch and over-flags. Motion density instead asks "is the screen actually
changing?" Calibration from the fixture: static card ~0.3/s; frozen admin dashboard
~0.4-0.5/s; sluggish/stalled UI ~0.6-2/s; healthy interaction 5-9/s. The 2.0/s
cut cleanly separates dead from live; the 4s floor avoids flagging a single brief
window. This is what surfaced the fixture's 66s frozen background-job-dashboard hold
that a per-span average had smeared away.

## 4. Freeze spans (`freezedetect`)
`freezedetect=n=-55dB:d=0.30` lists frozen spans >=0.3s. -55dB noise floor catches
near-static UI without tripping on codec noise. Each span is classified by whether
it overlaps a card region; UI freezes are graded warn (>1.5s) / error (>3.0s). This
is SUPPORTING data only — it pinpoints the exact frozen frame inside a region. It is
deliberately NOT used to extract frames (it over-fires); the dead-air scan owns the
still-frame frame set. Demo-segment freezes should be <=~0.25-0.5s; <=1-2s only when
an on-screen annotation is deliberately held.

## 5. Glitch clusters (scene-cut clustering)
>=3 scene cuts inside a 1.2s window, where the window does NOT bracket a card
(checked by sampling the colour just before/after the cluster). A burst of cuts in
the middle of a single UI region = an unexpected page refresh / stray jump / hop,
not an intended transition (card cross-dissolves are excluded because they touch a
card). On the fixture this isolates the four post-approval page reloads. The probe
extracts a `pre` and `post` frame per cluster so the subagent can confirm the screen
content actually changed (real refresh) vs merely flickered (benign).

## 6. Luma/contrast sampling (`signalstats`-style 3x3 grayscale)
Each span midpoint is also reduced to a 3x3 grayscale grid (mean/min/max/spread).
Cheap coarse signal for the subagent to spot low-contrast or inherited-colour traps
(e.g. light text on light bg) without needing the full frame. The subagent confirms
on the actual frame; this just flags candidates.

## Bounded frame set
The probe extracts (at 1280px wide): one representative per scene span, three per
dead-air region (start/mid/end), and a pre+post pair per glitch cluster. ~50 frames
for a 5min video. No per-freeze frames. This is the "bounded, well-chosen" set the
analysis subagent reasons over — never the raw video, never thousands of frames.

### Card-span frame guarantee
Every detected card (a `cardBlock` — the finest card unit, after the signature
split that separates two cards sharing one brand background) is *guaranteed* a
frame, sampled at the block midpoint clamped strictly inside the block (so the
in/out cross-dissolve frames, which average toward the neighbouring UI screen, are
never picked). The report's top-level `cardSpans` array is the machine-readable
card->frame map: each entry has the block's `start`/`end`/`duration`/`midpoint` and
the `framePath` of its guaranteed frame (`cardspan-N-mid-Ts.png`).

This closes a false-absent gap: a short card (e.g. a ~3.6s opening COVER) sharing a
brand background with the next card (e.g. the agenda) merges into one colour span,
so that span's midpoint lands on the *agenda* and the COVER would otherwise have no
clean in-card representative — the analysis would see no cover frame and wrongly
report it absent. **Never conclude a scripted card is absent without inspecting the
frame named for its block in `cardSpans`.** The guarantee is block-level, not
span-level, precisely because cover and agenda are one span but two blocks.

## Tunables
`--card-rgb R,G,B` (required per brand), `--card-tol` (45), `--demo-freeze` (0.5,
warn gate hint), `--annot-freeze` (1.5, held-annotation tolerance hint). The freeze
grade gates (1.5/3.0s) and dead-air threshold (2.0/s, 6s window, 4s floor) are
constants in the script; adjust there if a different video style needs it and record
why in `validation-notes.md`.

## 7. Scripted-card cross-check (`--cards-file`)
Cards are authored narration, so verifying them is a first-class output, not a
side-effect of the card/ui split. Detected `card` spans are merged into blocks
(a card's cross-dissolve in/out registers as two scene cuts, so one card can span
two cuts). Two authored cards on the *same* brand background (e.g. cover -> agenda)
produce no scene cut at all and land in one block; each block is therefore re-split
by its 8x8 grayscale text signature — where the signature shifts by more than ~6
mean-abs per cell between ~1s samples, the on-screen text changed, i.e. a new card.
On the fixture this correctly splits the 0-10.13s blue block into cover (0-3.5s) and
agenda (3.5-10.13s), matching the source clip durations.

With `--cards-file` (a JSON array of `{label, minRead?}` in storyboard order), each
expected card is paired positionally to a detected block and scored present /
too-brief (`duration < minRead`, default `--card-min-read` 2.5s) / missing, plus a
`countMatches` flag and any `extraBlocks`. The probe owns count, duration and order;
legibility, wording and "undercut by neighbours" are the analysis subagent's job
over the per-card `card-I-text` (read the card) and `card-I-after` (the frame right
after it) frames. Positional pairing assumes cards appear in script order — true for
authored narration; a count mismatch is itself surfaced as a finding rather than
silently mis-aligning.

## 8. Annotation-aware dead air (optional, `--annotate-rgb`)
Demo recorders draw a "look here" call-out — a thin rounded-rectangle ring in the
annotation colour around a UI element — and hold it ~1.5-2s on purpose so a
silent-demo viewer can read what it points at. That held frame is intentional
pacing, not dead air, but the motion-based scan (detector 3) flags it because it is
static. When `--annotate-rgb R,G,B` is supplied (e.g. `204,65,65` for #CC4141), each
dead-air region is sampled at its midpoint and tested for a ring.

Ring test: count pixels within `--annotate-tol` (default 40 per channel) of the
annotation colour and take their bounding box. A ring is (a) a *moderate* cluster —
`matchPx >= 500`, above the handful the cursor alone contributes but far below a
solid fill — that is (b) clustered into ONE compact box: aspect ratio within
[0.15, 6.5], box area <= 85% of the frame, and box fill < 0.5 (an outline covers its
box thinly). The bounding box is what separates a ring from incidental brand-colour
UI (a status pill, a disabled-action icon, the cursor): those land as a few hundred
pixels *scattered across the row*, giving a very wide/flat box (aspect in the tens),
whereas a ring around one control is a roughly square-ish box. Thresholds tuned on
the reference fixture: a real upload-control ring = ~1490-1550px in a ~547x482 box
(aspect ~1.13) → ring; incidental row red = ~560px in a 1683x36 box (aspect ~47) →
not a ring.

Each dead-air region gets `annotated` (bool) plus `annotateMatchPx` / `annotateBox`
/ `annotateAspect`. Annotated regions are **excluded from the headline
`deadAir.regionCount` / `totalSec`** (they are intentional) and listed separately in
`deadAir.annotatedRegions`, but stay in `deadAir.regions` so the analysis subagent
can still sanity-check the ring points at the right thing. Without `--annotate-rgb`
every region is `annotated: false` and the headline counts are unchanged — the whole
feature is behind the flag.
