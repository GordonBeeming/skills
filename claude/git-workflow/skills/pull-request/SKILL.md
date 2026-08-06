---
name: pull-request
description: "Own the whole PR cycle: commit, create a draft PR with Copilot review, iterate with review bots via a delegated Sonnet teammate while still draft, publish after 3 clean ticks, resolve comments throughout, and merge (lead-verified) with linked-issue closing comments. Use when User says '/pull-request', 'PR autopilot', 'pull request autopilot', 'create autopilot for this work', or gives a PR URL wanting comments resolved ('resolve PR comments', 'fix PR feedback', 'address review comments'). Not for bare 'create a PR' / 'ship it' (normal draft-PR flow via the gitbutler skill), reviewing other people's PRs (review-pr / pr-review-backlog), or Dependabot batches (dependabot-review)."
---

# Skill: pull-request

## Purpose

One skill for the produce-and-merge PR cycle. The lead (main session) routes the scenario, creates the PR when needed, and delegates the watch/resolve loop to a Sonnet teammate; the teammate iterates with the review bots (draft first, then published) and the lead handles escalations, does the merge, and posts closing comments. User stays in the loop only for the decisions that are genuinely his.

Reference files carry the procedures:

- `references/create.md` — commit + draft PR + Copilot review request (lead runs this)
- `references/autopilot-loop.md` — the teammate's tick loop, draft and published phases
- `references/resolve-comments.md` — triage/fix/reply/resolve, with mode-routed decision gates

## Repo tiers

Detect at routing time from the git remote owner:

- **Personal** — `github.com/user/*`. Lighter escalation: the lead handles scope-creep issue creation and human skip decisions itself, escalating to User only when genuinely uncertain ("there shouldn't be that many, but use your judgment"). Signing verification applies (see `create.md` and the loop reference).
- **Standard** — everything else. The full authority table below, unmodified.

Both tiers: squash merge (squash commits are still signed going into main and keep history short; fall back only when a repo disallows squash — ask User once and persist to repo memory), draft phase applies, re-opened threads always go to User.

**Merge gate differs by tier:**
- **Personal** — don't wait for 3 clean ticks or an extended idle window. Once every configured bot has completed its **first review pass** on a head and any threads from it are resolved, the **next tick with no new comments** is merge-ready: flip to ready and merge, provided CI has actually **passed** (green, not pending, not red), 0 unresolved threads, `mergeable = MERGEABLE`, `mergeStateStatus` ∈ {CLEAN, HAS_HOOKS}. No 300s idle wait. The point is to get the bots' first look and act on it, not to sit on a clean PR. (Bots not configured on the repo are non-blocking, as always — "every configured bot" means the ones that actually review this repo.)
- **Standard** — the full gate below: 3 consecutive clean ticks + the Phase-2 idle clock.

Discover merge policy via rulesets, not just repo settings: `gh api repos/<o>/<r>/rules/branches/main` returns `allowed_merge_methods`, `required_review_thread_resolution` (an unresolved thread makes `mergeStateStatus: BLOCKED` even with zero required approvals), and the `copilot_code_review` config — `review_draft_pull_requests: false` there is why the draft phase requests Copilot review explicitly (learned on the ide repo, 2026-07-12).

## Scenario routing (first thing, every invocation)

1. **PR identified** — a URL/number in the ask, or this session already created one → existing-PR flow: skip creation, spawn the teammate. Its first tick runs immediately, so unresolved feedback gets a resolve round straight away (this replaces the old standalone resolve-comments entry point). If User said "resolve only" or clearly wants a one-off round without the loop, run `references/resolve-comments.md` directly in the main session (direct mode) and stop after the summary.
2. **No PR yet** for the current work → run `references/create.md` (verify → commit → draft PR → Copilot review request), then spawn the teammate.
3. **Ambiguous** → `AskUserQuestion` with: PRs already mentioned/created in this conversation, **"Create a pull request for `<current branch>`"**, "Discover my open PRs" (then `gh pr list --author @me --state open --json url,title,number` and a follow-up question), "I'll paste a URL", and cancel. Never auto-discover or start a loop without User confirming the target.

## Spawn the teammate

One named Sonnet teammate per PR: `Agent(name: "pr-autopilot-<n>", model: "sonnet")`. The prompt must carry:

- The PR URL/number and instruction to follow `references/autopilot-loop.md` (give the absolute path) with `references/resolve-comments.md` in delegated mode.
- The repo tier (personal/standard) — it changes the lead's answers, and signing checks on personal.
- Repo git rules: GitButler `but` only, existing `gb/` branch, no raw `git commit`, no signing changes, no co-author trailers, `but clean --pull` after every push, SSH-agent approval failures are report-and-stop.
- A one-paragraph summary of the change so review replies are informed, plus any design decisions a bot might wrongly flag (e.g. offsets that must stay full-line).
- The reminder: never merge, never undraft before 3 clean ticks, escalate via SendMessage and keep ticking while waiting.

Then arm the lead's own wake cycle at **~10 minutes** (Monitor poll or scheduled wakeup), phase-aligned to the teammate's 5-minute ticks: every teammate tick report carries its timestamp, so on each wake compute when the next tick is due. Next tick due within ~a minute → stay up for it and handle whatever it raises; otherwise schedule the next wake to land just after the teammate's next expected tick, so escalations and merge-ready reports get answered within moments of being sent instead of sitting half a cycle. Teammate messages also arrive push-style and wake the lead on their own — the 10-minute cycle is the backstop for a teammate that's gone silent (two consecutive expected ticks with no report = treat as stalled: check its transcript, message it, respawn if dead). Verify liveness before ever ending a turn with "waiting".

## Escalation authority (the lead's decision table)

| Escalation from teammate | Lead decides alone | Goes to User |
| --- | --- | --- |
| Question-only reply, answer clearly established in session/PR context | ✅ | Unknown answer → User |
| Merge-conflict resolution, mechanical/non-overlapping | ✅ | Ambiguous → User |
| Scope-creep issue creation | Personal tier: ✅ (judgment) | Standard tier: always (plan-mode gate) |
| Human skip-plans | Personal tier: ✅ (judgment; a human contradicting the task's explicit goal still → User) | Standard tier: always |
| Re-opened threads (sign-off footer detected) | — | Always, both tiers — hard rule |
| Merge method unknown / squash unavailable | — | Once; persist to repo memory |
| CI red and teammate's fix failed | May direct one retry strategy | Repeated failure → User |
| 3-hour cap reached | — | User decides whether to restart |

When forwarding to User, use the gate form the reference specifies: plan mode for skip-plans, scope-creep splits, and closing comments; `AskUserQuestion` for the rest. Relay the teammate's block content verbatim — don't re-summarise it thin.

## Merge (lead only)

On the teammate's merge-ready report, re-verify independently before acting — trust but verify, the evidence may be a tick stale:

1. Re-run the `reviewThreads` GraphQL count yourself; non-zero → send the teammate back, do not merge.
2. `gh pr checks` all green (required and non-required, nothing running); `mergeable = MERGEABLE`; `mergeStateStatus` ∈ {CLEAN, HAS_HOOKS}; required reviews satisfied.
3. Merge: `gh pr merge <n> --repo <owner>/<repo> --squash --delete-branch`. Never `--admin`, never `--no-verify`-style bypasses. If protections reject it, back to the loop — no retries with force.
4. Wait for the merge to propagate before pulling (the git ref lags the API a few seconds; pulling early silently leaves the workspace behind):
   ```bash
   merge_sha=$(gh pr view <n> --repo <owner>/<repo> --json mergeCommit --jq .mergeCommit.oid)
   for i in {1..20}; do
     remote_main=$(git ls-remote origin main | awk '{print $1}')
     [ "$remote_main" = "$merge_sha" ] && break
     sleep 2
   done
   but clean --pull
   ```
5. Personal tier: confirm the squash commit shows signed/verified on GitHub, and wait for post-merge CI on the merge commit to succeed.
6. Stop the backstop Monitor and release the teammate (a short SendMessage so its transcript closes cleanly).

## Closing comments on linked issues (lead, User-gated)

Mandatory after a merge when the PR body linked issues (`Closes #N` / `Fixes #N` / `Resolves #N`). GitHub auto-closes without context; the comment supplies it.

1. Draft 3–6 tight lines per issue: root cause as it relates to the issue's symptom, the fix, PR link + merge SHA, and an explicit retest ask (tagging the reporter) when a platform couldn't be verified locally.
2. Open a **fresh** `EnterPlanMode` and overwrite the announced plan file — the harness reuses one plan file and `ExitPlanMode` renders only that file, so stale implementation-plan content must be wiped, not appended to. Format:

   ```markdown
   # Closing comment for PR #<pr-n>

   **PR:** https://github.com/<owner>/<repo>/pull/<pr-n> (merged as <short-sha>)
   **Issue:** https://github.com/<owner>/<repo>/issues/<issue-n> — <issue title>
   **Reporter:** @<reporter-login>

   ## Expected closing comment

   <the literal comment body that will be posted>
   ```

   Multiple issues: one H1, repeat the block per issue, one approval for the batch.
3. On approval: `gh issue comment <issue-n> --repo <owner>/<repo> --body "<approved body>"`. The gate holds even when the body looks obviously fine — only User knows whether to ping the reporter, soften tone, or skip an issue. Skip the step entirely only when no issues were linked; an already-closed issue still gets its comment (audit trail over state).

## Final summary

When the PR merges (or the run stops), report:

```
PR <number> <title> — <merged|stopped>
- Draft rounds: N (clean streak reached at tick M)
- Comments resolved: X (fixed A / already-done B / auto-skipped C / skip-approved D)
- Re-opened threads deferred to User: R
- Out-of-scope issues filed: Y (#a, #b)
- CI fixes pushed: Z
- Merged via: squash as <sha>
- Closing comments posted: <issue list or none linked>
- Total runtime: Nm
```

## Self-improvement (mandatory, end of every run)

After the final summary, review the run for friction: escalations that shouldn't have needed a round-trip, bot behaviour the references didn't anticipate, wording the teammate misread, commands that needed correcting live (e.g. the Copilot review-request incantation). Apply minor fixes to this skill and its references immediately — that's the global skills-self-improve rule working as intended. Propose major reshapes (new phases, changed authority, removed capabilities) to User instead of applying them. Every run should leave the skill slightly better than it found it.

## Key rules

- The teammate never merges, never bypasses protections, and never talks to User — all three are the lead's.
- The lead re-verifies merge evidence itself before merging; a teammate's green report is necessary, not sufficient.
- **One working-tree owner.** In repos where the lead and teammate share a single working tree (e.g. GitButler in the main repo — the teammate commits to the same checkout the lead sits in), the teammate is the sole editor/committer of *files* for the PR's duration; the lead does not edit, commit, or push source files while the teammate is live. If the lead has a fix, it hands it to the teammate as a spec, not a commit. (Observed on user/ide, 2026-07-13: lead and teammate both edited the same file concurrently after a "hold" that crossed in flight — no corruption that time, but only by luck.) Two exceptions are head-neutral and safe for the lead: editing the **PR description/title** (`gh pr edit`, no commit, no head move) and the merge itself. Proactively refresh the PR description after each scope change so a bot doesn't have to flag it stale (it flagged it 3× on that run).
- Re-opened threads go to User in every mode and tier — no judgment call absorbs them.
- Draft → ready: **standard tier** after 3 consecutive clean ticks (5-minute ticks); **personal tier** after the bots' first review pass has landed + resolved and the next tick has no new comments (CI green) — no 3-tick streak, no idle wait. Definitions live in `autopilot-loop.md`.
- Squash everywhere; a repo that can't squash triggers one User question, persisted to memory.
- Bot silence is not approval — every expected bot responds to the current head before a tick counts as clean or a merge report goes out.
- Gates are mode-routed, never skipped: direct mode → User, delegated mode → lead per the authority table.
- The old `/pr-autopilot`, `/pr-resolve-comments`, and `/create-pr-autopilot` entry points all live here now; route their asks through scenario routing.
