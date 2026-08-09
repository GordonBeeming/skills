# Branch-review artifact

One durable, self-contained HTML artifact per iteration. It reads top-down like an exec brief: the
verdict and top risks are settled before any scrolling; the expert detail is below for whoever needs
it. This file covers only what's **specific to a branch review**. Location, branding, clickable links,
the visual-QA loop, light-mode default, and the humanizer pass are governed by the global rules —
follow those, don't re-derive them here:

- **Location** (`~/Developer/artifacts/<project>/review-branch/`), **VS Code Insiders clickable
  `file:line` links** with `DISPLAY_STRIP_PREFIX` shortening, and the mandatory **Playwright visual-QA
  loop** (1920×1080 render, screenshot, fix overflow/clipping/contrast/broken-links/console errors,
  re-shoot, then delete the screenshot) + default wrap styles → `~/.claude/rules/agents-and-tools.md`.
- **Branding** — resolved by the `brand-guidelines` skill (see its `references/routing.md`) —
  and the mandatory **humanizer** pass on all prose → `~/.claude/rules/content-writing.md`.
- **Light mode** default → the `feedback_visual_output_theme` memory.

## Filename

```
branch-review-<siding-or-branch>-iter<N>.html
```

Keep every iteration's file — the series is the paper trail of the change getting hardened.

## Required sections (in order)

Keep the first viewport useful: title, verdict, score, and top risks visible without scrolling.

1. **Header** — title, repo, base vs target (siding/branch/stack/PR), date, iteration number, reviewer.
2. **Verdict strip** — `Bulletproof` / `Close` / `Not ready`, plus the **bulletproofness score** and
   its **delta vs the previous iteration** (`72 → 88, +16`). `Bulletproof` requires zero confirmed
   findings at or above the bar — a change with confirmed ≥bar findings is `Close` or `Not ready`, never
   "ready with follow-ups". Do not use the artifact to rationalise deferral: confirmed findings are
   framed as *to fix now*, and a finding only appears as deferred once the **user** chose to drop it
   (record that choice and their reason), never on the skill's own recommendation.
3. **Exec summary** — 3–5 sentences a non-author could act on: what the change does, the top risks, and
   what still stands between it and merge. No jargon dumps.
4. **Iteration delta** — fixed / regressed / new / carried counts and the notable movers (skip on
   iteration 1, show a "baseline" note instead).
5. **Severity table** — confirmed findings, ordered Blocker → Low, columns: severity, expert, title,
   `file:line` link, confidence, suggested fix.
6. **Per-expert detail** — one block per expert that ran, each listing its confirmed findings with
   evidence and impact. Note experts that ran and found nothing (that's a signal, not an omission).
7. **Verification log** — every command that was run to prove a finding, with its real result
   (including failures and skips). This is the "ran X, got Y" evidence.
8. **Filtered appendix** — sub-threshold and false-positive findings, kept visible with a one-line
   reason each, so nothing is silently dropped.
9. **Open questions** — manual checks the reviewer should still do, and anything that couldn't be
   verified.

## Severity model

- **Blocker** — likely user-facing breakage, security issue, data loss, or a hard merge-blocker.
- **High** — plausible production bug or a missing required validation.
- **Medium** — meaningful maintainability, observability, race, or edge-case risk.
- **Low** — polish, naming, comment balance, test gaps, follow-up questions.

## Finding fields (per row / block)

severity · expert · concise title · `file:line` link (local refs as VS Code Insiders links per the
global rule; GitHub links for remote-only PR evidence) · evidence · impact · suggested fix · confidence.

When there are no confirmed findings at or above the bar, say so plainly at the top and still list the
residual risks and manual checks — "bulletproof" is a claim that has to survive the reader's scrutiny.

## Data source

Render from `findings-iter<N>.json` (schema in `state.md`) so the artifact and the machine-readable
state never drift. Compute the delta against the previous iteration's JSON.
