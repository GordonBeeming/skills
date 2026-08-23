# Reference: autopilot watch loop (the teammate's brief)

You are a delegated autopilot teammate watching one pull request. Your job: iterate with the review bots while the PR is a draft, flip it to ready once the bots go quiet, keep it healthy after publish, and hand a merge-ready report to the lead. **You never merge.** The lead merges, posts closing comments, and talks to User — you talk only to the lead via `send_message`.

Everything here assumes the repo rules from your spawn prompt, including its git route: GitButler commands only in managed repos, otherwise the approved plain-Git path. Keep the existing branch, preserve signing, add no co-author trailers, sync with the route-appropriate command after each push, and stop/report on SSH-agent approval failures.

## Never bypass merges — and never perform them

No `--admin`, no `--no-verify`, no `gh pr merge` at all. If everything is green, that's a report to the lead, not a merge command. This split exists so a second set of eyes re-verifies the evidence before anything irreversible happens.

## Never run side-effecting scripts against the live environment

When a review fix touches a script that writes outside the repo — an installer, a launcher generator, a symlink setup (e.g. `install-cli-command.sh` writing `~/.local/bin/ide`) — do **not** run it bare to test it. It will clobber the user's real environment — e.g. running a real installer to test a fix can repoint a live `~/.local/bin/<tool>` symlink at a throwaway bundle. Test the generated output in isolation: an override env var if the script honors one (ide's installer takes `IDE_CLI_BIN_DIR`), a temp `--prefix`/`DESTDIR`, or extract and lint the emitted artifact (`bash -n`, `shellcheck`) without executing its install step. If you can't isolate it, verify by reading, and say so — don't run it live.

## Tick cadence

- Ticks run every **5 minutes**. The **first tick runs immediately** on spawn — if the PR already has unresolved feedback, the first thing that happens is a full resolve round, not a wait.
- Between ticks, wait using the background-wait mechanism available in your harness (e.g. a backgrounded `sleep 300` you resume on, or your scheduler if you have one). Don't busy-poll.
- **The background-wait notification often does NOT re-invoke you into a new turn**: the timer fires and the completion event just sits until the lead sends a message. Foreground `sleep` is blocked by the harness, so you can't hand-roll a wait either. Net effect: **treat a nudge from the lead as your heartbeat** — the lead polls the PR every ~10 min and messages you to run the next tick. Do the tick when nudged, report, idle. Don't burn cycles diagnosing a "freeze" that is really just this — but do tell the lead once, early, that you rely on their nudge so they don't mistake you for dead.
- **Hard cap: 3 bot-driven review/fix rounds total**, as defined below. Also stop after 3 hours of total runtime and report to the lead.

## Phase 1 — draft

The PR was created as a draft with Copilot's review requested. Bots iterate here where reviews are cheap; publishing waits until they've gone quiet.

Per tick:

1. Sync with the route from the spawn prompt (`but clean --pull` for GitButler; the approved fetch/pull path for plain Git). On conflicts, see "Conflict handling" below.
2. Refresh PR state:
   ```bash
   gh pr view <n> --repo <owner>/<repo> --json isDraft,mergeable,mergeStateStatus,state
   ```
   `state = MERGED`/`CLOSED` → report to the lead and exit.
3. Fetch unresolved review threads — required every tick, no shortcuts. Use the GraphQL `reviewThreads` query from `resolve-comments.md` Step 1, then count:
   ```bash
   ... | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length'
   ```
   That number is the only acceptable source for the `Threads: N unresolved` line in your tick report. `gh pr view --json reviews` is NOT a substitute — it returns top-level review submissions and misses inline threads entirely. A PR can show `reviews: []` with 6 unresolved threads. This rule has been broken before; the "I checked `reviews` and it was empty" pattern is exactly how a PR merges with ignored feedback.

   **Re-run the query fresh every tick — never carry forward a prior tick's count** (reusing a prior count while only re-checking CI can report "0 unresolved" when bots posted several threads in between). Bots comment asynchronously, often minutes after a push, so a count is stale the moment the next comment lands. If you report a thread count, you ran the GraphQL query in *this* tick.
4. Fetch check-run annotations per `resolve-comments.md` Step 1.5, and CI state:
   ```bash
   gh pr checks <n> --repo <owner>/<repo> --json name,state,bucket,link,workflow
   ```
5. **Work exists** (threads > 0, or failure/warning annotations, or red CI)? Run the full `resolve-comments.md` procedure in delegated mode. Check queued lead messages immediately before committing so a lead disposition cannot race the fix. For red CI: fetch failing logs (`gh run view <run-id> --log-failed`), diagnose, fix, commit/push through the configured git route. Escalate if the fix fails.
6. **After every push**, re-nudge draft-shy bots only while both limits remain: fewer than 3 total bot-driven review/fix rounds and fewer than 3 explicit requests for that bot. A review/fix round is one feedback batch that causes code/docs changes and a new head. Once round 3 is pushed, finish its threads and gates but request no bot again. Continue reading unsolicited feedback; resolve non-blocking late suggestions with evidence, and escalate a late critical/security/data-loss finding instead of starting round 4.

   **Ask both, every head, explicitly.** The review set is Copilot and Codex (plus CodeRabbit only where it's wired up). Request each on every new head while the caps allow — not just whichever looks behind. A round isn't complete until both have responded to the current head.

   **Never request Claude, and never nudge `@claude`.** It runs as a GitHub Actions workflow, so each request bills User's Actions minutes. Where a repo auto-runs it, its output is free information worth reading, but never trigger it and never count it as a pending bot. **Never request Gemini (`gemini-code-assist[bot]`) either — it's retired.** Both surface in older PRs' review history during bot-set discovery; ignore them, and treat their output and their silence as equally non-blocking.

   Bot-specific signals:
   - CodeRabbit: comment `@coderabbitai review` only when its current-head check-run has not already covered the head. Repeated nudges can rate-limit it; a non-required "Review rate limited" check is a throttle, not a code failure.
   - Codex: comment `@codex review` on every head, without waiting to see whether it shows up on its own. Detect a clean pass in top-level issue comments or a 👍 PR reaction as well as review objects.
   - Claude: never nudged (see above). Where a repo auto-runs it, it posts as a top-level issue comment rather than a `reviews` object, so read any verdict there — but its absence is never a reason to wait.
   - Copilot does **not** reliably auto-re-review on push — on some repos a new head gets no fresh Copilot review until you **explicitly re-request via the API per head**: `gh api -X POST repos/<o>/<r>/pulls/<n>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'`. Don't wait a tick or two hoping it auto-runs; if its latest `reviews` entry's `commit.oid` isn't the current head, re-request immediately. `reviewRequests` empties as it consumes the request, so confirm completion via a `reviews` entry whose `commit.oid` equals the current head (GraphQL), not by the request list.
7. **Score the tick.** A tick is **clean** when ALL of:
   - Zero new bot comments since the previous tick
   - Zero unresolved review threads (from the GraphQL count) and every thread has our reply
   - Zero failure-level check-run annotations
   - Every requested/expected bot has responded to the current head SHA — **silence is not approval**; an explicit unsupported-file response counts, no response doesn't
   - CI is not red (running is acceptable in draft; red is work)
   Anything else resets the consecutive-clean counter to zero.
8. **Flip to ready** — threshold depends on tier (from your spawn prompt), but only after the lead confirms the full local test suite is green (docs-only diffs may be waived):
   - **Standard tier:** 3 consecutive clean ticks.
   - **Personal tier:** as soon as every *configured* bot has completed its **first review pass** on a head and any threads it raised are resolved, the **next clean tick** (no new comments, CI green/passed) is enough — no 3-tick streak. Don't sit on it. (First tick after spawn, before any bot has looked, does NOT qualify — the bots must have had their first look.)
   ```bash
   gh pr ready <n> --repo <owner>/<repo>
   ```
   Report the flip to the lead, then enter Phase 2.

## Phase 2 — published

Draft CI can be a subset. After the ready flip, re-read head-scoped check runs because full build/test/deploy jobs and draft-skipping bots may start only then. Never treat a skipped draft matrix or a superseded older-head failure as the live merge gate.

Per tick, same steps 1–6 as the draft phase, plus the merge-readiness evaluation. Two extra rules now apply:

- **Idle clock.** Derive, don't store:
  ```
  ready_for_review_at = last ReadyForReviewEvent from timelineItems (GraphQL below), else createdAt
  idle_baseline       = max(latest_commit.committedDate, ready_for_review_at)
  idle_seconds        = now - idle_baseline
  ```
  ```bash
  gh api graphql -f query='query { repository(owner:"<o>",name:"<r>"){pullRequest(number:<n>){timelineItems(last:50, itemTypes:[READY_FOR_REVIEW_EVENT]){nodes{... on ReadyForReviewEvent {createdAt}}}}}}' \
    | jq -r '.data.repository.pullRequest.timelineItems.nodes | sort_by(.createdAt) | last | .createdAt // empty'
  ```
  The `max(...)` matters: anchoring idle time to the last commit alone once let a freshly-published PR "merge" within 60 seconds because its last commit was 26 minutes old — before any reviewer had a chance to look. A fresh commit pushes the clock forward AND the draft→ready flip pushes it forward.
- **Merge-readiness (report, don't merge).** All must hold:
  - `Threads: 0 unresolved` — from the GraphQL query this tick
  - Zero failure-level annotations
  - `mergeable = MERGEABLE`, `mergeStateStatus` ∈ {`CLEAN`, `HAS_HOOKS`} (never `BLOCKED`, `BEHIND`, `DIRTY`, `UNSTABLE`)
  - Required reviews satisfied (`reviewDecision = APPROVED` where the repo requires review; `null` fine when it doesn't)
  - All CI checks green — required AND non-required — and nothing still running
  - Every expected bot has responded to the current head
  - `idle_seconds ≥ 300` (or ≥ 900 as the safety cap when everything else has been green that long) — **standard tier only. Personal tier skips the idle wait entirely:** once the bots' first pass has landed + resolved and a subsequent tick is clean with CI green, report merge-ready immediately, no idle threshold.

  When every line holds, `send_message` the lead a **merge-ready report**: each condition with its actual value, the thread-count line, checks summary, `mergeStateStatus`, `reviewDecision`, head SHA, and idle timings. Then keep ticking (a reviewer can still post) until the lead merges or redirects you.

  When the repo requires human review that hasn't arrived, keep waiting and say so in your tick report — that's the expected state, not a failure. If the 3-hour cap approaches with a human reviewer outstanding, escalate to the lead.

## Tick report (every tick, to the lead)

Keep it terse — the lead relays what matters to User:

Capture the timestamp at report time with `date -u '+%Y-%m-%dT%H:%M:%SZ'` (or the runtime equivalent). Never emit a rounded, placeholder, guessed, or partially formatted timestamp. If timestamp capture fails, omit the timestamp instead of inventing one.

```
PR #<n> <phase: draft|published> — tick at <UTC ISO>
Threads: N unresolved (reviewThreads GraphQL)
Annotations: N failure / N warning
CI: <each check: name — state>
Bots responded to head: copilot ✅ / coderabbit ✅ / codex ✅
Review/fix rounds: X of 3 | Clean streak: X of 3 (draft) | Idle: Xm since baseline (published)
Action taken: <resolve round | CI fix pushed | nudged bots | none — waiting>
```

Batch it into one message per tick. If nothing changed and no action was taken, one line is fine: `PR #<n> tick <time>: no change, streak 2/3`.

## Escalations (`send_message` to the lead, then wait)

Send the exact block content `resolve-comments.md` specifies for the gate you hit — skip-plan template, scope-creep template, re-opened table, question-only table. Flag re-opened threads as `User required`. Also escalate: conflict resolutions you're not certain are mechanical, repeated CI fix failures, the 3-hour cap, and anything where you'd otherwise be guessing. Waiting on an escalation doesn't stop the loop — keep ticking the other work.

## Conflict handling

If the route-appropriate sync reports conflicts:

1. Identify conflicts with the configured route (`but status -fv` for GitButler, normal status for plain Git).
2. Enter that route's resolution flow.
3. Read both sides. If mechanical, apply, finish, push the named PR branch, and report it. In GitButler, never use a bare non-interactive `but push` because it can push every applied branch.
4. If it's ambiguous, escalate to the lead with the file list — the lead approves mechanical resolutions itself and takes ambiguous ones to User. Do not guess.

## Signing (personal-tier repos)

When the lead's spawn prompt marks the repo personal-tier: after each push confirm the commit carries a `gpgsig` header and GitHub reports it verified. Never disable or bypass signing to make a commit land; a signing failure is an escalation.

**1Password signing is flaky and separate from auth.** Commit signing goes through the `op-ssh-sign` helper, a DIFFERENT 1Password path from the ssh-agent used for fetch/push — so `git ls-remote`/push working does NOT mean signing works. `but commit` intermittently fails with `CommitSigningFailed / 1Password: agent returned an error` (or `failed to fill whole buffer`); **retry the `but commit` once and it usually goes through**. If it keeps failing after a retry, that's a hard block (the 1Password app is locked / not running) — escalate to the lead to have User unlock it. Never route around signing.
