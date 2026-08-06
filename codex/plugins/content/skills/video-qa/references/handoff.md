# The mandatory subagent hand-off

## Rule
Every `video-qa` invocation runs the analysis in a fresh independent subagent (the
`Agent` tool). The caller thread never reads the extracted frames and never reasons
over the report. No exceptions, no "small video so I'll just look" shortcut.

## Why — token isolation
The probe produces, for a 5-minute video, a large JSON report and ~50 PNG frames.
Reading those frames into a thread is tens of thousands of tokens of images, plus
the model's own multi-step reasoning over them. That is the heavy context. If it
lands in the caller's window it:

- crowds out whatever else the caller is doing in that session,
- gets summarised/truncated as the conversation grows, degrading later turns,
- and is pure waste once the issue list exists — nobody needs the 50 frames again.

A subagent has its own context window. It absorbs the report, the frames, and all
the reasoning, and returns only the short timestamped issue list. The caller's
context grows by a few hundred tokens (the list) instead of tens of thousands. The
expensive material is born and dies inside the subagent.

## The caller's whole job
1. Locate inputs (video path, storyboard, branding).
2. Run `scripts/probe.mjs` (this is cheap text output — a summary + paths).
3. Spawn the subagent with `references/analysis-prompt.md` filled in.
4. Relay the returned list.

Steps 1-4 keep the caller's context small. Note that step 2's probe summary (span
counts, region counts) is fine to read — it is a few lines of text. It is the
*frames and frame-reasoning* that must stay out of the caller.

## Subagent returns text, not files
Instruct the subagent to return its findings as its final message. It should not
write a report file (the caller relays the message; a file would just be re-read).
