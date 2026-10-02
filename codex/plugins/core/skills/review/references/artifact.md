# The review artifact

One self-contained HTML file per run (per batch for `backlog`). It reads top-down like a brief: the
verdict and the top findings sit in the first viewport, the detail below for whoever needs it.

Location, brand, clickable `file:line` links, the visual QA loop, and light mode are owned
elsewhere; this file only says what a review artifact contains.

- Path: `/Users/user/Developer/artifacts/<repo>/review-<pr-or-branch>-<yyyymmdd>.html`.
  Backlog: `review-backlog-<batch>-<yyyymmdd>.html`. Blind: `review-<pr>-blind-<yyyymmdd>.html`.
  `<repo>` is the repo name without the owner.
- Brand: the `brand-guidelines` skill resolves it from the repo path (personal unless the org routes
  elsewhere) and supplies tokens, base shell, and logo rules.
- Links: local `file:line` references as VS Code Insiders links with the display prefix trimmed, per
  the global artifact rule; GitHub links for evidence that only exists on the PR.
- QA: the global visual QA loop (1920 by 1080 render, contrast on every text-on-colour pair, no
  clipping, no mojibake) runs before the `file://` link is handed back.

## Length

Substance only. The artifact carries what the chat report cannot: every finding with its evidence,
the verification log, the appendix. No introduction restating the request, no closing summary, no
section kept for symmetry when it would be empty. A two-file PR gets a short findings table and a
short verification log, not the full skeleton padded out.

## PR or branch, `standard`

In this order:

1. **Header**: title, PR URL or branch, repo, base and head, date, depth, reviewers that reported.
2. **Verdict strip**: `approve` or `hold`; with `--focus`, `meets`, `partial`, or `fails`.
3. **TL;DR**: the reason for the verdict in one or two lines.
4. **Brief to evidence** (only with `--focus`): each criterion, what was checked, what it showed.
5. **Findings table**: ordered Blocker to Low. Columns: severity, title, `file:line`, confidence,
   suggested fix. Every row links to its detail block.
6. **Finding detail**: per finding, evidence quoted from the code, impact, suggested fix, and the
   verification command and result where one ran.
7. **Verification log**: every command run in step 4 with its real result, failures and skips
   included. "Ran X, got Y."
8. **Review threads and checks**: unresolved threads with author and path; check status.
9. **Open questions**: what could not be verified (including `unverified` findings) and the smallest
   next check for each.

No Blocker or High: say so at the top and still list the Mediums, Lows, and open questions. An
"approve" has to survive the reader's scrutiny too.

## PR or branch, `deep` additions

- **Per-seat detail** after the findings table: one block per seat that ran, its confirmed findings,
  and a line for a seat that ran and found nothing (a signal, not an omission). A seat covered by the
  lead says so.
- **Runner pass** (with `--reviewer`): its findings in the same shape, its session or conversation id
  for resume.
- **Filtered appendix**: every `filtered` and `false-positive` finding with its score and a one-line
  reason, so nothing is dropped out of sight.
- **Fix plan**: the items from `fix-plan.md` and the `$work` line to run it.

## Backlog batch

1. **Header**: repo, batch name (author or stack), PRs in the batch, date, depth.
2. **Triage row per PR**: number, title, author, label from triage, conflict scope in a few words.
3. **Per PR**: two or three sentences on what it does, the approve or hold call, then either what
   was verified (approve) or the findings with severity and `file:line` (hold). Write-back status:
   approved with URL, held with reason, or excluded by which gate.
4. **Stack note** (linear stacks only): the reading order and what the deepest PR carries.
5. **Excluded before review**: one line per PR the gates kept out, with the gate.

## Blind

Sections follow the taxonomy in `references/depth-matrix.md`, one per non-empty bucket, numbered
(`01 The core change`) so the reading order is explicit.

- **Hero**: the core change stated as a claim ("Access stops being decided by a cached list alone"),
  not a topic.
- **Counts strip**: a few tiles of mechanically derived numbers (files, call sites, tests added).
  Each label says what the number is.
- **Core change**: what it was, what it is now, the smallest verbatim excerpt that shows the new
  shape, labelled with file and side (`TokenCache.cs, the manager branch, after`).
- **Downstream sections**: what the core forces, the call-site table, carried-along changes.
- **Consequences**: callouts, described and not graded.
- **What the tests pin**.
- **Provenance footer**: "Read from the PR diff only: N source files, M test files, +X / -Y."

No severity, no verdict, no recommendations section, nothing sourced from the description, threads,
or commit messages.

## Finding fields

severity, title, `file:line` (or a PR thread link), evidence, impact, suggested fix, confidence;
at `deep` also the seat and the status. Identifier columns get enough width that a name does not
break mid-token.
