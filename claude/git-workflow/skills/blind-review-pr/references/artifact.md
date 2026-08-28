# Blind-review artifact

Create a durable artifact for every run. This file covers only what's **specific to a blind review**.
Location, branding, links, the visual QA loop, light mode, and the humanizer pass are governed by my
global rules — follow those, don't re-derive them here:

- **Location** (`~/Developer/artifacts/<project>/`), **VS Code Insiders clickable links** +
  `DISPLAY_STRIP_PREFIX` shortening, and the mandatory **Playwright visual QA loop** (1920×1080 render,
  screenshot, fix overflow/clipping/contrast/broken-links/console errors, re-shoot, then delete the
  screenshot) + default wrap styles → `~/.claude/rules/agents-and-tools.md`.
- **Branding** — resolved by the `brand-guidelines` skill (see its `references/routing.md`) — and the
  mandatory **humanizer** pass on all prose → `~/.claude/rules/content-writing.md`.
- **Light mode** default → `feedback_visual_output_theme` memory.

## Filename

```text
pr-<number>-changes.html
```

## Shape

The section order follows the taxonomy in `SKILL.md`, one section per non-empty bucket. Number the
section kickers (`01 · The core change`) so the reading order is explicit. The artifact's argument is
that everything after section 01 exists because of section 01, and the numbering carries that.

- **Hero** — the core change stated as a claim in the headline, not a topic. "Access stops being decided
  by a cached list alone" tells the reader something; "Fund access caching changes" doesn't.
- **Counts strip** — a few tiles of mechanically-derived numbers (new files, call sites touched, tests
  added). Each label says what the number *is*; no tile restates the request.
- **Core change** — what it was, what it is now. A before/after pair works well when the change is a
  behavioural swap. Include the smallest code excerpt that shows the new shape.
- **Downstream sections** — what the core forces, the call-site table, carried-along changes.
- **Consequences** — asymmetries, new costs, deliberate omissions. Callouts, not a findings table: this
  is description, not severity.
- **What the tests pin** — what breaks if a specific behaviour or ordering regresses.
- **Provenance footer** — the source and the counts: *"Read from the PR diff only: N source files, M test
  files, +X / −Y."* This earns its place because it tells a reader the analysis is independent of the
  author's claims, which changes how they weigh it. Keep it factual; it's provenance, not a note about
  what was asked for.

## Code excerpts

Quote the smallest fragment that makes the point, and quote it verbatim from the diff, because a
paraphrased "roughly this" excerpt is the fastest way to make the whole artifact untrustworthy. Label
each block with the file and which side of the change it shows
(`TokenCache.cs — the manager branch, after`).

## Tables

The call-site table's columns are the ones that vary across rows. When every row lands in a different
place inside its method, "where in the method" is a column; when they're all trivially at the end, it
isn't, so drop it rather than filling it with "after the save" ten times.

Give single-token identifier columns enough width that names don't break mid-identifier
(`SubscriptionRenewalServic` / `e.RenewAll` on two lines reads as a rendering bug).

## What doesn't belong

- Severity, priority, or a verdict — that's `review-pr`'s artifact.
- Anything sourced from the PR description, review threads, or commit messages.
- A "recommendations" or "next steps" section. The blind review describes the change; what to do about it is a
  separate conversation.
