# Validation notes — reference fixture

Fixture: a ~5:20 1920x1080 product walkthrough with cover / agenda / interstitial /
recap cards and a multi-step approval flow across two apps, v1 cut, reviewed by a
human who flagged 12 issues. The skill was tuned until a fresh analysis subagent —
given only the probe's JSON report + the bounded ~50-frame set + the storyboard, no
knowledge of the golden list — independently reproduced that list. The scorecard
below maps all 12 golden findings to caught / partial / missed / n-a, with the
timestamp the tool actually reported.

Iteration 2 (timestamps below) followed an independent re-run that confirmed the
mechanical catches but was softer on judgment calls — it dismissed transition
flashes/reloads as benign, presence-checked cards instead of judging whether they
land, under-weighted navigation style, and false-flagged a missing cover card. The
analysis prompt was sharpened on those four axes (generalised, not memorised to v1):
brief login/loading/empty/admin flashes and mid-segment reloads are now defects;
cards are judged for landing (legible duration + not undercut by neighbours);
navigation style is a first-class per-segment check; and cover vs agenda cards are
matched by content so an existing cover is not reported missing.

## Scorecard (iteration 2, after the judgment-call tuning)

| #  | Human golden finding | Verdict | Tool-reported timestamp | How |
|----|---|---|---|---|
| 1  | Nav page-hops instead of browsing the product | caught | 00:11 list-page entry (span-003) explicit "page-hop, not browsed"; login/empty flashes 00:10/00:42/01:19/03:12 | navigation now a first-class check — named the hard cut into the deep page with no nav step, plus every plumbing flash |
| 2  | Caption late (~6s frozen frame at app-B load ~48-54s) | partial | dead-air windows 48-54 (4.17/s)/54-60 (2.17/s); span-008 | the literal caption gap sits inside an active (page-loading = real motion) window so it is not mechanical dead air. Subagent reached an equivalent finding by reasoning (app B opens on an unrelated empty view, upload beat not demonstrated). Inherent limit — see note below |
| 3  | File upload not shown (cursor never moves to control) | caught | deadair-1 (01:06-01:18, region 66-78) | explicit — dropzone shown, no choose-file interaction in any frame |
| 4  | No upload confirmation (highlight / toast) | caught | deadair-1 (01:06-01:18) | explicit — no confirmation frame anywhere in segment B |
| 5  | Documents view never opened in segment B / count doesn't refresh | caught | spans 008/013 (segment B), span-021 (03:21 documents view) | flagged the upload+folder never shown in segment B, plus empty list-view grids |
| 6  | Long dead air / frozen stills after upload | caught | deadAir regions 30-36, 66-78, 96-102, **108-174 (66s)** | windowed motion-density scan; 90s total dead air incl. the 66s hold |
| 7  | Background-job admin dashboard on screen | caught | span-015 + deadair-3 (01:38-02:54) | "worst offender", ~78s of a frozen background-job console with code/config text visible |
| 8  | ~3:38 stray cursor + page refresh + movement (glitch) | caught | glitches 03:42 / 04:09 / 04:36 / 04:58 + skeleton flash span-029 | now framed as mid-segment dashboard-bounce reloads (defects), not benign — exactly the iter-2 sharpening |
| 9  | Documents view shows 3 files, only 1 uploaded | light note (by design) | spans 021/024/030 (03:21+) | iter-3 intentionally dials this back — verifying the "right" file count needs product knowledge a generic reviewer lacks, so it's a one-line note, not a built-up case. Obvious tells (blank attribution, placeholder text, unshown end-state) are still caught |
| 10 | Earlier-row approval broken (status complete, empty approver line) | caught | span-004/005 (00:24-00:30) | one history row reads complete with a blank attribution line, vs a sibling row that shows a proper approver name + date |
| 11 | "Now assigned" interstitial not noticeable / missed | caught | span-017 (03:08) | the "behind the scenes / now assigned" card now judged for landing — flagged as undercut by the empty list-view frames bracketing it |
| 12 | Hero subtitle dark-on-accent contrast trap | n/a | — | On the companion HTML artifact, NOT the video. The luma/contrast detector + prompt step would catch an equivalent in-video trap, but no such frame exists in this fixture |

**Tally: 9 caught, 1 partial (#2), 1 light-note-by-design (#9), 0 missed, 1 n-a
(#12, not a video issue).** Every golden item present in the video is reproduced; #9
is now a deliberate light note rather than a count-forensics case (iter-3), and the
scripted-card items (#11 and the card structure generally) are now caught via a
dedicated per-card check rather than incidental reasoning.

## Iteration 3 — scripted cards as a first-class check (+ lighter product-data)
Two refinements: (a) the scripted cards (cover/agenda/interstitials/recap) became a
rigorous per-card check with its own deterministic report section; (b) the deep
product-data checks (file counts etc.) were dialled back to obvious tells only.

**Card cross-check (`--cards-file` → report `cardCheck`).** Detected `card` spans are
merged into blocks, then each block is re-split by its 8x8 text signature so two
authored cards on the *same* brand background (cover → agenda, no scene cut between
them) separate correctly. On v1 this splits the 0-10.13s blue block into cover
(0-3.5s) + agenda (3.5-10.13s) — matching the source clip durations — and pairs all
six storyboard cards to detected blocks: **countMatches true, 6/6 present**. The
iter-3 analysis run then verdicts each card individually (present + legible + on-brand
confirmed, and the *undercut* check fired on 5 of 6 — agenda→login, app-B-card→login,
back-to-app-A→login+empty-dashboard, now-assigned→empty list view, recap→collapsed
row). This **supersedes the iter-2 "cover card missing" extra**, which was a detection
limitation (cover+agenda merged into one block), not a real defect — the cover is
present and now detected as its own card.

**Lighter product-data (step 7).** The analysis no longer reverse-engineers
product-specific counts. The iter-3 run dropped the "3 files vs 1 uploaded" forensics
to a one-line "looks like an intentional anonymised fixture" note, while keeping the
obvious tells (blank-attribution completed/approved rows, placeholder/joke text, an ending that
doesn't show the promised end-state). Golden #9 (the 3-vs-1 count) is therefore now
*intentionally* downgraded to a light note rather than a built-up case — by design,
since verifying the "right" count needs product knowledge a generic reviewer lacks.

## Extras the tool surfaced beyond the golden list
Legitimate findings a human would also want, not in the 12:
- **Repeated login + empty-dashboard skeleton flashes** between most beats
  (00:11/00:42/01:23/03:12) — plumbing that should be edited out.
- **Empty list view** ("no records to display") shown between beats and bracketing
  the "now assigned" card.
- **Final payoff not shown** — the closing list page leaves the row collapsed, so
  the promised final status is never visibly displayed though the recap card claims it.
- **Off-script clutter** — an unrelated record visible in the list view during the
  post-approval bounces.

## Which items are mechanical vs reasoning
- **Mechanical (script catches the signal directly):** #6 dead air (motion-density
  windowed scan — surfaced the 66s frozen region a per-span average had hidden),
  #8 glitches (scene-cut clustering), and the structural framing for #7 (the held
  region is flagged; the subagent reads the frame to name it as a background-job
  console).
- **Reasoning over bounded frames:** #1 nav style, #3/#4 missing upload + confirm,
  #5/#9 documents-view counts, #7 "this is plumbing", #10 broken row, #11 missed
  card. These
  need the model judging frame content against the script — which is exactly why
  the bounded frame set + storyboard hand-off exists.
- **Partial / inherent limit:** #2's literal caption-timing gap. The page is loading
  (real motion) so it is not "dead air"; a caption-region detector would overfit
  this one video. The subagent reasons to an equivalent finding instead. Recorded,
  not hard-coded.
- **Not exercised by this fixture:** #12 (dark-on-blue contrast) is on the companion
  HTML artifact, not the video. The probe's per-span luma 3x3 sampling + the prompt's
  contrast/inherited-colour step are the machinery that would catch an equivalent
  in-video trap, but no video frame in this fixture has one, so it is scored n-a.

## Tuning history (what moved the needle)
1. Raw `freezedetect` over-fired (119 "freezes" on a screen recording) — replaced as
   the primary dead-air signal by `mpdecimate` motion density. Freezes kept as
   supporting data only.
2. Per-span motion average smeared the 66s frozen hold across nearby active seconds
   (one 78s "span" looked merely low). Switched to a fixed 6s windowed scan over the
   whole timeline, merging contiguous low windows — this localised the real hold.
3. Single-pass `mpdecimate,showinfo` (one decode, JS-bucketed) replaced per-window
   re-decoding.
4. Dropped per-freeze frame extraction (30+ redundant frames) — dead-air + span +
   glitch frames are the bounded, well-chosen set (~50 frames).
5. Sharpened the analysis prompt's data-integrity step to scrutinise attribution
   lines on completed/approved rows — this is what turned #10 from a miss into a catch.
6. Iteration 2 — an independent run nailed the mechanical items but was soft on
   judgment calls. Four generalised prompt sharpenings (no v1 specifics hard-coded):
   (a) brief login/loading/empty/admin flashes between beats, and reloads within a
   segment, are defects — not "benign transitions"; the glitch step's default stance
   flipped from benign-unless-proven to defect-unless-pre/post-are-identical.
   (b) cards judged for whether they *land* — too brief to read, or undercut by a
   contradicting/empty neighbouring frame — not presence alone.
   (c) navigation style promoted to a first-class per-segment check (browsed vs
   page-hop into a deep page).
   (d) cover vs agenda cards matched by content so an existing cover/agenda is not
   false-flagged missing. Result: the soft dismissals became firm findings and the
   false "missing cover" became a true catch, with no regression to the mechanical
   catches.
7. Iteration 3 — scripted cards promoted to a first-class check. (a) The probe gained
   a deterministic card cross-check: merge card spans into blocks, re-split each block
   by its 8x8 text signature (so cover→agenda on one background separate), and pair to
   an `--cards-file` storyboard list with present/too-brief/missing + countMatches.
   This is what turned the iter-2 false "missing cover" into a correct 6/6-present
   detection. (b) The analysis prompt gained a dedicated per-card step (read each
   card's `text` + `after` frames; verdict present/legible/placed/undercut) and a
   dedicated Part-1 output section. (c) Product-data checks (step 7) were dialled back
   to obvious tells only — no reverse-engineering of product-specific counts.

## Performance
Probe wall-clock ~1-1.5x video duration (three full-video filter passes + per-scene
sampling + ~50 frame extracts). Acceptable for a once-per-video QA pass. The cost is
in ffmpeg, not tokens; the subagent reasons over ~50 frames + one JSON, and only the
short issue list returns to the caller.
