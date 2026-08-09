# Methodology — why deterministic mechanics + bounded reasoning

## The core principle
Do not hand the whole video to a model and ask "critique this." That is expensive
on every run (every frame decoded into tokens) and non-reproducible (the same video
yields different nitpicks each time). Instead split the work:

- A **deterministic script layer** does the mechanical, repeatable detection:
  measuring duration/resolution, finding scene boundaries, classifying brand cards
  vs live UI, measuring motion density to find dead air, clustering scene cuts to
  find glitches, sampling luma for contrast traps. Same input -> same numbers,
  every time, for cents of compute.
- A **bounded reasoning layer** (a fresh subagent) then judges the things only a
  model can: is this the right screen for this beat, is that an internal admin tool
  that shouldn't be on screen, did the navigation hop or browse, is the on-screen
  data wrong, is a beat missing. It reasons over the compact JSON report + a
  well-chosen ~50-frame set, not the raw video.

The script answers "what mechanically happened and where"; the subagent answers
"does what happened match what was supposed to happen." Each does what it is good
at, and the costly part (frame reasoning) runs once over a bounded set.

## Why motion density is the key insight
The naive mechanical signal for "dead air" is `freezedetect`. On a screen recording
it is almost useless on its own: the cursor is still between actions, so freezedetect
fires on nearly every stretch and the report drowns in false positives. The signal
that actually separates dead air from activity is **how often the screen visibly
changes** — `mpdecimate` unique-frames-per-second. A static card sits at ~0.3/s, a
frozen dashboard at ~0.4/s, healthy clicking at 5-9/s. Threshold the density, not the
freeze. This single substitution is what turns a noisy 119-freeze list into a clean
"4 dead-air regions, one of them 66 seconds."

## Why a per-window scan, not per-scene
Long single-screen UI regions (one dashboard held for a minute) have few scene cuts,
so a per-scene motion average smears a 66s frozen hold across the few active seconds
around it and the region stops looking dead. Scanning fixed 6s windows across the
whole timeline localises the dead air regardless of where scene cuts fall, then
contiguous low windows merge back into one reported region.

## Why brand-card classification matters
A demo legitimately holds still on its intro/interstitial/recap cards — that is not
dead air. Without separating cards from live UI, every card reads as a multi-second
freeze and the report cries wolf. Classifying by dominant brand colour (a card is a
near-uniform fill of the brand colour) lets the same stillness be "expected" on a
card and "a defect" on a product screen.

## What stays mechanical vs what needs the model
Mechanically detectable and done in the script: dead air, structure, card/ui split,
glitches, gross contrast. Genuinely needs the model over frames: off-script content
(an admin tool, an error screen), missing/wrong beats, navigation style, wrong data
(counts, broken rows), missing annotations. The skill draws the line there on
purpose — see `detectors.md` for the per-detector detail and `validation-notes.md`
for how each reference golden item fell on one side or the other.
