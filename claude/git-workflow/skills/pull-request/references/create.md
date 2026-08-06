# Reference: create the draft PR

The lead runs this when the routed scenario is "no PR yet for this work". Output: a draft PR with Copilot's review requested, ready for the teammate to start draft-phase iterations.

## 1. Verify state

```bash
but status -fv
```

Confirm there are uncommitted changes or unpushed commits worth a PR. If there's nothing to commit and no PR-worthy state, ask User what he wants instead of proceeding on an empty branch.

Run the standard repo-entry checks if this session hasn't yet: `shunt-dev active` (siding question if it's a shunt app) and `but clean --pull`.

## 2. Commit

Follow the GitButler skill conventions:

1. Use IDs from `but status -fv`.
2. Draft a commit message matching the project's existing style (`git log` for tone). No co-author trailers.
3. On a new piece of work, create the branch first: `but branch new gb/<descriptive-name>` (the `gb/` prefix is required).
4. `but commit <branch> -m "<msg>" --changes <ids> --status-after`
5. Multiple logical changes staged → multiple commits, not one giant one.

On personal-tier repos, confirm the commit is signed (`gpgsig` present; GitHub shows verified after push). Never disable signing to get a commit through.

## 3. Create the draft PR

Check for a repo PR template first (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, `docs/pull_request_template.md`) — if one exists it's the base, sections kept and filled.

Write the body to a file (scratchpad or `.git/`): **line 1 is the title** (under ~70 chars, repo's title style), blank line, then the description with `## Summary`, `## Test plan`, and `Closes #<issue>` when there's a linked issue. Run the humanizer pass on the body — it's human-facing prose.

```bash
but pr new <branch> --draft -F <body-file>
```

Do not pass `-t` — in the current GitButler CLI `-t` means `--default`, not title. Capture the PR URL from the output. Pair-programming fields (if the repo template has one) list humans only.

Run `but clean --pull` after the push.

## 4. Request Copilot review on the draft

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

This REST POST is the working form (confirmed on user/xylem, 2026-07-12) — its response echoes `Copilot` in `requested_reviewers`. The `gh pr edit <n> --add-reviewer Copilot` fallback does NOT work for this bot (fails `Could not resolve user with login 'copilot'`); prefer the REST POST.

**`reviewRequests` reading empty right after a successful POST is normal, not a failure** — Copilot consumes the request almost immediately as it queues its review, so `gh pr view <n> --json reviewRequests` can show `[]` seconds later even though the POST returned `Copilot`. Don't loop re-requesting on the lead side; the teammate's loop re-requests only if Copilot hasn't responded to the current head SHA. Confirm the POST itself succeeded (its `--jq '.requested_reviewers[].login'` prints `Copilot`) and hand off.

CodeRabbit, Gemini, and Codex don't need requesting here — the teammate nudges them per `autopilot-loop.md` step 6 (`@coderabbitai review`, `/gemini review`, `@codex review`).

## 5. Hand off

Return to SKILL.md's "Spawn the teammate" step with: PR URL and number, repo tier, branch name, and a one-paragraph change summary the teammate can use for informed review replies.
