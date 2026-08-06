---
name: review-pr
description: >
  Evidence-backed pull request review. Use when the user gives a PR URL, branch, or diff range and
  asks to validate it works, find concerns/risks, sanity-check an implementation, or decide whether
  it's safe to approve — especially when they supply a brief to validate against. Inspects the live
  PR via gh, reads the surrounding code, runs targeted validation, and produces a durable branded
  HTML artifact plus a concise findings summary. Do not use for fixing PR review comments (use
  the pull-request skill) or autopilot merge flows (also the pull-request skill) unless explicitly asked.
---

# Skill: review-pr

## Purpose

Complete an evidence-backed PR review that answers the user's specific brief and leaves a durable
artifact they can inspect or share. Findings are tied to behaviour and exact references, not vibes.

Done when:

- the live PR metadata, diff, files, review threads, and check status have been inspected
- the review states whether the implementation meets the user's brief
- findings are prioritized by impact and backed by exact links or `file:line` references
- uncertainty is named with the smallest next validation step
- the HTML artifact is created **and rendered/visually checked** (see `references/artifact.md`)

## Inputs

Infer or collect:

- PR URL, repo, branch, or local diff range
- review focus — e.g. "validate it works", "find concerns", "check this code path"
- any domain context the user supplies
- whether to post comments — default is **no posting**

Ask a narrow question (via `request_user_input` in Plan mode when available, or directly otherwise) only if the PR target or review goal can't be inferred.

## Evidence rules

- Start from the live PR, not cached assumptions.
- For GitHub PRs use `gh pr view --json …`, `gh pr diff`, `gh pr checks`, and the changed file list.
  For unresolved review feedback, query GraphQL `reviewThreads` — `gh pr view --json reviews` alone
  misses thread resolution state.
- Read the surrounding implementation in the base branch or local checkout before judging changed
  code. A diff line is not enough context to call a bug.
- Run targeted validation when it's practical and low-risk — prefer tests/builds that directly cover
  the changed behaviour.
- When external API, package behaviour, or platform rules matter and local dependency source is
  absent or likely stale, check current primary sources (Context7 or the Microsoft Learn MCP).
- Stop searching once the artifact can answer the brief with cited evidence and remaining uncertainty
  is explicitly named.

## Workflow

1. **Establish PR state**: title, author, base/head, file list, line counts, draft state, review
   decision, merge/check status, unresolved review threads.
2. **Restate the brief** as concrete review criteria.
3. **Inspect** the diff and the surrounding code paths that determine whether the change works.
4. **Validate** behaviour with targeted tests, builds, static checks, local package source, logs, or
   screenshots as appropriate. If local validation needs the PR code checked out, apply the branch
   into the GitButler workspace via the `gitbutler` skill (`but`) — never raw `git checkout`, and
   never work from `origin/<branch>` refs alone.
5. **Classify findings**:
   - **Blocker** — likely user-facing breakage, security issue, data loss, or direct brief failure.
   - **High** — plausible production bug or missing required validation.
   - **Medium** — meaningful maintainability, observability, race, or edge-case risk.
   - **Low** — polish, naming, test gaps, or follow-up questions.
6. **Create the artifact** — read `references/artifact.md` first.
7. **Render and visually check** the artifact (Playwright MCP visual QA loop per global rules).
8. **Final response**: link the artifact, list the top findings, include validation commands/results.

## Validation notes

- Prefer the narrowest test/build that exercises the changed behaviour over a full suite.
- In a client project, the `aspire`, `test-writer`, and `db-query` skills cover running the app, writing
  integration tests, and inspecting local data.
- Report honestly: which commands ran and what they returned, and which were skipped or failed. "Ran
  X, got Y" beats "should be fine". A green check is data, not proof the brief is met.

## Boundaries

- Don't edit PR code unless the user explicitly asks for fixes.
- Don't post GitHub review comments without showing the draft or being explicitly asked to post.
- Don't treat green checks as proof the brief is met — connect evidence to behaviour.
- Apply PR branches only through the `gitbutler` skill; stay on `gitbutler/workspace`.

## Output

Return:

- artifact path or URL
- verdict against the brief (Meets / Partially meets / Does not meet)
- prioritized findings with `file:line` or PR-thread references
- validation performed, including any commands that failed or were skipped
- remaining open questions or manual checks
