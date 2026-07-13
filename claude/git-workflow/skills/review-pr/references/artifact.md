# PR Review Artifact

Create a durable artifact for every review. This file covers only what's **specific to a PR review**.
Location, branding, links, the visual QA loop, light mode, and the humanizer pass are governed by my
global rules — follow those, don't re-derive them here:

- **Location** (`~/Developer/artifacts/<project>/`), **VS Code Insiders clickable links** +
  `DISPLAY_STRIP_PREFIX` shortening, and the mandatory **Playwright visual QA loop** (1920×1080 render,
  screenshot, fix overflow/clipping/contrast/broken-links/console errors, re-shoot, then delete the
  screenshot) + default wrap styles → `~/.claude/rules/agents-and-tools.md`.
- **Branding** (personal-brand-guidelines default; `brand-guidelines` for `client-org/*`,
  `brand-guidelines` for `client-org/*`) and the mandatory **humanizer** pass on all prose →
  `~/.claude/rules/content-writing.md`.
- **Light mode** default → `feedback_visual_output_theme` memory.

## Filename

```text
pr-<number>-<short-topic>-review.html
```

## Required sections

Keep the first viewport useful — title, verdict, and top findings visible without scrolling.

- **Header** — title, PR URL, date, reviewer, repo, base/head branches.
- **Verdict strip** — `Meets brief`, `Partially meets brief`, or `Does not meet brief`.
- **TL;DR** — the main reason for the verdict, one or two lines.
- **Brief → evidence map** — each criterion the user asked about, mapped to what was checked.
- **Findings table** — ordered by severity (see below).
- **Code-path notes** — exact `file:line` links for the paths that decide whether the change works.
- **Validation** — commands run and their results, including failures and skips.
- **Review threads / checks** — unresolved threads and check status.
- **Open questions** — manual validation the reviewer should still do.

## Severity model

- **Blocker** — likely user-facing breakage, security issue, data loss, or direct brief failure.
- **High** — plausible production bug or missing required validation.
- **Medium** — meaningful maintainability, observability, race, or edge-case risk.
- **Low** — polish, naming, test gaps, or follow-up questions.

## Finding fields

Each finding includes:

- severity
- concise title
- `file:line` or PR-discussion link (local refs as VS Code Insiders links per the global rule; GitHub
  links for remote-only evidence)
- evidence
- impact
- suggested review action

When there are no blocking findings, say so clearly and still list residual risks or manual checks.
