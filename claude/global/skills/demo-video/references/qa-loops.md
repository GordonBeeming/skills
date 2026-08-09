# QA loops (mandatory)

Treat these like tests — don't sign off from a thumbnail or "it looked right in my head". The screenshot
is the source of truth. Re-build or re-record until every loop is clean.

## 1 · Probe the final MP4

```
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,display_aspect_ratio \
  -show_entries format=duration,bit_rate -of default=noprint_wrappers=1 final.mp4
```

Expect width=1920, height=1080, `display_aspect_ratio=16:9`, SAR 1:1. Bitrate should be healthy for
text (a real run landed ~450–680 kb/s at CRF 14/16); a sub-200 kb/s 1080p screen video is the
artifacting smell — check the CRF/preset.

## 2 · Eyeball frames from the final MP4

Pull frames and actually look at them: the **cover**, a **content beat** mid-recording, and **each
card** (agenda with its blurb, interstitial, end). `ffmpeg -ss T -i final.mp4 -frames:v 1 f.png`. Check:
text crisp (not smeared), lower-third present and correct, no clipped/overlapping elements, framing
sensible. Beware landing on a page-load white flash — sample a few `T`s.

**Confirm the interstitial is actually in the timeline** if there were off-camera steps: don't just trust
that the card PNG rendered — grab a frame inside its window and confirm "Behind the scenes" + every off-camera
step is on screen. A rendered-but-not-concatenated interstitial is the classic miss (the card exists on disk
but never made it into the `concat` list, so it's absent from the video).

## 3 · Verify every annotated still

Open each `vid/shots/*.png`. Check the annotation box rings the right element, the lower-third step
matches, and the data shown is what you expect.

## 4 · Cross-still consistency (the cautionary tale)

**Every still in one walkthrough must come from a single coherent run.** The failure mode: stills grabbed
in separate passes drift — e.g. a dialog showing "0 items" next to a run that created "1 of 1", or mismatched
counts/dates between stills.
Because `shot()` captures live mid-recording, a clean single recording gives consistent stills for free —
but verify it: read the stills as a sequence and confirm the numbers/years/states line up across them and
with the video.

## 5 · Artifact visual-QA loop (mandatory — same loop as any artifact)

After embedding in the HTML artifact, run the **full global artifact visual-QA loop** — the same one any
artifact gets, not a lighter version. Skipping it is not acceptable even if it "looks right in my head";
the screenshot is the source of truth.

1. **Serve + open at 1920×1080.** `file://` is usually blocked in this Playwright build, so serve the dir
   (`python3 -m http.server <port> --directory <artifact-dir>`) and open the `http://localhost:<port>/…`
   URL in Playwright. Resize to 1920×1080.
2. **Full-page screenshot AND zoom in.** Take the full-page shot, then zoom into every region where text
   sits on a non-white background — the brand-coloured hero, badges/pills, callout cards, the video
   poster strip. A contrast failure invisible at thumbnail scale is glaring at 100%; don't sign off from
   the thumbnail alone.
3. **Review for:** text clipping, text overflowing containers, cut-off card content (long file paths /
   identifiers in captions and code refs are the usual culprit), overlapping elements, broken alignment,
   stray scrollbars, **and accessibility/contrast** —
   - **Inherited-colour traps:** any `<code>`/pill/badge that can sit on more than one background needs an
     explicit `color` per context (e.g. a light code chip dropped on the dark hero inherits light text and
     vanishes).
   - **WCAG AA:** body/small text ≥ 4.5:1, large/bold ≥ 3:1 against its actual background. Brand accents
     often fail on white — use the brand's darkest variant for links/code on light surfaces, reserve the
     bright accent for dark backgrounds and large text.
   - **Keyboard focus:** interactive elements (the video controls, links) have a visible `:focus-visible`
     outline.
4. **Captions match stills** — re-read every `<figcaption>` against its image (see §6). This is the thing
   that rots after a re-record.
5. **Fix the CSS and re-screenshot** until a clean pass. Common fixes: explicit `color` on chips/code per
   background; swap a failing accent for a darker brand variant on light; `overflow-wrap:anywhere` +
   `word-break:break-word` on long `<code>`/captions; `minmax(0,1fr)` / `min-width:0` on grid children so
   long tokens wrap instead of overflowing.
6. Only after a clean pass, **clean up the screenshots** (and stop the http server) and hand the artifact
   path back.

## 6 · Captions match stills

After any re-record, the stills change — re-read every artifact caption against its (new) still and fix
drift (years, counts, states). Then re-run the humanizer on any caption you touched.

## 7 · The video-qa gate — a bounded re-record loop (run before handing over)

The final QA is the **`video-qa`** skill: it takes the cut + the storyboard (pass the `--cards-file` list of
every card in order) and returns a timestamped ✅/❌/⚠️ issue list (dead air over threshold, glitches,
internal plumbing on screen, off-script navigation, card-doesn't-land, branding/contrast traps, missing
beats). It always runs in its own handed-off subagent, so its heavy frame analysis never lands in this
context. This is not a one-shot gate — it drives a **re-record loop**:

1. **Cut version N.** Build the MP4 (`vN/` — keep every version's MP4, don't overwrite; the artifact
   archives them all, see `artifact.md`).
2. **QA it.** Run `video-qa` against the storyboard. **Persist the full findings list for version N
   verbatim** (a `vN-qa.json`/`.md` next to the cut) — every version's feedback is shown in the artifact, so
   User sees the whole progression, not just the final product.
3. **Action every finding.** Fix the recorder / build / staged data for **each** ❌ and ⚠️ — not a subset.
   Re-build → version N+1. **Prefer re-recording the whole lifecycle over splicing a single new segment
   into older ones:** a multi-segment demo carries state between segments (a record created in segment A is
   uploaded in B, prepared in C, signed in D), so a freshly-recorded middle segment shot against a different
   run's state is inconsistent (different ids, mismatched stages). If you must re-shoot just one segment,
   make it **surgical** — re-create the exact same state the other segments expect, or you'll splice an
   incoherent cut. When in doubt, re-record end-to-end from the reset baseline.
4. **Repeat** from step 1 until `video-qa` comes back **clean** (no actionable ❌/⚠️), **or you reach the
   cut cap.**
5. **Cut cap (default 10; confirm the number for the run).** If the cap is hit without a clean pass,
   **STOP — do not silently exceed it.** Escalate with the per-version change list (what each cut flagged and
   what you changed), the outstanding findings, and the current cut. The user decides whether to continue,
   accept, or redirect.

Don't ship on "looks right in my head", and don't sign off a still/artifact from a thumbnail (zoom into
every text-on-coloured-background region; a contrast trap is invisible at thumbnail scale). The loop ends on
a clean QA pass **or** the cut-cap escalation — never on "good enough" without one of those.

## 8 · Don't film internal plumbing

Background-job dashboards, DB tools, infra/admin screens are not product. If the demo needs that state
change, cover it with an interstitial ("in the product this is automatic; for the demo we trigger it
ourselves") and do the trigger **off-camera** (a non-recorded helper), then cut to the result. Only film
the plumbing when the plumbing is the feature.
