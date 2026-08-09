# Artifact

The deliverable alongside the videos is a self-contained HTML artifact: the videos (with poster frames),
the walkthrough stills, and written copy explaining the feature. Follows the global artifact rules.

## Location & branding

`/Users/user/Developer/artifacts/<project>/<feature-slug>/` with an `img/` subdir for stills +
posters and the MP4s alongside `index.html`. Brand it via the `brand-guidelines` skill, which resolves the
right brand from the project's directory and context — unless told otherwise. Artifacts don't go in source
control.

## Embedding videos

```html
<video controls preload="metadata" poster="img/video1-poster.png"
       style="width:100%;border-radius:8px;border:1px solid var(--line);">
  <source src="video1.mp4" type="video/mp4" />
</video>
```

Poster = a cover frame (`ffmpeg -ss 2 -i video.mp4 -frames:v 1 img/video1-poster.png`). `preload="metadata"`
keeps the page light while still showing the poster.

## Stills + captions

Drop the `vid/shots/*.png` into `img/`. Each gets a `<figure>` with an `<img>` (descriptive `alt`) and a
`<figcaption>`. **Captions must match the still exactly** — the precise year/count/state visible in the
image. This is the thing that rots after a re-record; re-check it every time (see `qa-loops.md` §6).

## Version history + QA archive (mandatory when the cut went through the video-qa loop)

The artifact is not just the final product — it shows **how the demo got there**. When the cut went through
the `video-qa` re-record loop (`qa-loops.md` §7), include a **Version history** section that archives every
version with its QA feedback:

- **Latest version → a real `<video>` player** (embedded, with poster), exactly as above.
- **Earlier versions → links, not players.** Each prior `vN.mp4` is a download/open link (keep the files
  alongside `index.html`, e.g. `archive/v1.mp4`), so the page stays light but the full progression is
  recoverable.
- **Every version shows its QA feedback.** Under each version (latest included), list the `video-qa`
  findings for that cut verbatim — the ✅/❌/⚠️ items it returned — and, for superseded versions, what was
  changed in response. The reader can see v1's problems, the fix, v2's remaining issues, and so on, down to
  the clean pass (or, if the cut cap was hit, the outstanding list that was escalated).

Structure it as a vertical timeline / list: `v1 (link) — N findings → fixed X, Y, Z`, `v2 (link) — …`,
`v3 (player) — clean` (or `escalated: 2 open findings`). Don't collapse it to a single "final" entry; the
per-version feedback is the point. Run the per-version findings copy through the humanizer like any prose.

**Update the artifact the moment a new cut exists — every cut, no deferring.** As soon as you build `vN+1`,
update the artifact in the same breath: copy `vN+1.mp4` into `archive/`, promote it to the top player (and
refresh the poster + walkthrough stills from it), demote the previous "latest" to a link, append the new
version's timeline entry with its QA, and bump the intro's cut count. Do NOT wait until the demo is "done",
"clean", or "signed off" to catch the artifact up — a built cut that isn't in the artifact is unfinished
work, and batching several versions later is how the artifact silently falls behind (it has, repeatedly).
The artifact tracks the live progression, so it should never be more than one cut behind the newest build.

## Clickable code refs

When the copy references a file/line on this machine, link it with the VS Code Insiders scheme
`vscode-insiders://file/{absolute_path}:{line}` and shorten the visible text (per the global artifact
linking rule). The `src/...ClientLib` Kiota-generated client and similar are off-limits to cite as
"review this".

## Visual-QA + humanizer

Run the artifact visual-QA loop (`qa-loops.md` §5) — text contrast, overflow, posters, captions. Then run
the `humanizer` skill over all prose (intro, section copy, captions) and fix matches. Both are mandatory;
re-run the humanizer on any later prose change.
