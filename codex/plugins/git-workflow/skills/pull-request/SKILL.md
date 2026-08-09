---
name: pull-request
description: "Own the whole PR cycle: commit, create a draft PR with Copilot review, resolve feedback through at most 3 bot-driven review/fix rounds with a delegated Terra teammate, publish, and merge after lead verification. Use when User says '/pull-request', 'PR autopilot', 'pull request autopilot', 'create autopilot for this work', or gives a PR URL wanting comments resolved ('resolve PR comments', 'fix PR feedback', 'address review comments'). Not for bare 'create a PR' / 'ship it' (normal draft-PR flow via the GitButler skill), reviewing other people's PRs (review-pr / pr-review-backlog), or Dependabot batches (dependabot-review)."
---

# Skill: pull-request

## Purpose

One skill for the produce-and-merge PR cycle. The lead (main session) routes the scenario, creates the PR when needed, and delegates the watch/resolve loop to a Terra teammate; the teammate iterates with the review bots (draft first, then published) and the lead handles escalations, does the merge, and posts closing comments. User stays in the loop only for the decisions that are genuinely his.

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

Discover merge policy via rulesets, not just repo settings: `gh api repos/<o>/<r>/rules/branches/main` returns `allowed_merge_methods`, `required_review_thread_resolution` (an unresolved thread makes `mergeStateStatus: BLOCKED` even with zero required approvals), and the `copilot_code_review` config — `review_draft_pull_requests: false` there is why the draft phase requests Copilot review explicitly.

## Scenario routing (first thing, every invocation)

1. **PR identified** — a URL/number in the ask, or this session already created one → existing-PR flow: skip creation, spawn the teammate. Its first tick runs immediately, so unresolved feedback gets a resolve round straight away (this replaces the old standalone resolve-comments entry point). If User said "resolve only" or clearly wants a one-off round without the loop, run `references/resolve-comments.md` directly in the main session (direct mode) and stop after the summary.
2. **No PR yet** for the current work → run `references/create.md` (verify → commit → draft PR → Copilot review request), then spawn the teammate.
3. **Ambiguous** → ask User one concise interactive question with: PRs already mentioned/created in this conversation, **"Create a pull request for `<current branch>`"**, "Discover my open PRs" (then `gh pr list --author @me --state open --json url,title,number` and a follow-up question), "I'll paste a URL", and cancel. Use `request_user_input` when it is available in Plan mode; otherwise ask directly. Never auto-discover or start a loop without User confirming the target.

## Spawn the teammate

One named Terra teammate per PR: spawn `pr-autopilot-<n>` with `spawn_agent` — **once**. This background loop is standard review and monitoring work, so use `gpt-5.6-terra` with medium reasoning whenever the Codex surface exposes worker model selection; do not spend the Sol lead model on it. If model selection is not exposed by the current `spawn_agent` schema, use the normal teammate default and record that limitation rather than inventing unsupported arguments. To nudge, ack, or reply afterwards, use `send_message`, never a second `spawn_agent` call: spawning the same logical worker again creates a fresh contextless teammate and strands the real one. Use `interrupt_agent` only when the existing teammate genuinely needs to stop. The prompt must carry:

- The PR URL/number and instruction to follow `references/autopilot-loop.md` (give the absolute path) with `references/resolve-comments.md` in delegated mode.
- The repo tier (personal/standard) — it changes the lead's answers, and signing checks on personal.
- The git route for this repo: GitButler commands only when the repo is managed, otherwise the approved plain-Git route. Include the existing branch, no signing changes, no co-author trailers, route-appropriate sync after every push, and report-and-stop behavior for SSH-agent approval failures.
- A one-paragraph summary of the change so review replies are informed, plus any design decisions a bot might wrongly flag (e.g. offsets that must stay full-line).
- The reminder: never merge; use the tier-specific ready threshold; stop explicit bot requests after 3 total bot-driven review/fix rounds; escalate via `send_message` and keep ticking while waiting.

Then arm the lead's own wake cycle at **~10 minutes** with Codex recurring monitoring, phase-aligned to the teammate's 5-minute ticks: every teammate tick report carries its timestamp, so on each wake compute when the next tick is due. Scope CI reads to the current head SHA with `gh api repos/<o>/<r>/commits/<head>/check-runs`; superseded runs on older heads must not reset the live gate. Next tick due within ~a minute → stay up for it and handle whatever it raises; otherwise schedule the next wake to land just after the teammate's next expected tick. Teammate messages also arrive push-style and wake the lead on their own — the 10-minute cycle is the backstop for a teammate that's gone silent (two consecutive expected ticks with no report = treat as stalled: inspect with `list_agents`, message it, and respawn only if the original worker has ended). Verify liveness before ever ending a turn with "waiting".

Keep User updated on every check-in. Include the PR URL, phase, unresolved-thread count, CI state, review/fix round (`N/3`), and what changed; do not go silent between escalations.

Expect the teammate's 5-minute self-wake to be unreliable: its wait-notification often never re-fires after the first tick, so every subsequent tick needs a lead nudge — the backstop cycle carries the whole run. Treat a lead nudge per cycle as normal operation, not a failure, and when the backstop fires, check the PR state yourself (`gh pr view` + the reviewThreads GraphQL) before nudging so the nudge carries the current facts (new reviews, thread counts) instead of just "are you alive".

## Escalation authority (the lead's decision table)

| Escalation from teammate | Lead decides alone | Goes to User |
| --- | --- | --- |
| Question-only reply, answer clearly established in session/PR context | ✅ | Unknown answer → User |
| Merge-conflict resolution, mechanical/non-overlapping | ✅ | Ambiguous → User |
| Scope-creep issue creation | Personal tier: ✅ (judgment) | Standard tier: always (plan-mode gate) |
| Human skip-plans | Personal tier: ✅ (judgment; a human contradicting the task's explicit goal still → User) | Standard tier: always |
| Re-opened threads (sign-off footer detected) | — | Always, both tiers — hard rule |
| Convention / standard-design / ADR deviation | — | Always, both tiers — explicit user override required |
| Merge method unknown / squash unavailable | — | Once; persist to repo memory |
| CI red and teammate's fix failed | May direct one retry strategy | Repeated failure → User |
| 3-hour cap reached | — | User decides whether to restart |

When forwarding to User, use Plan mode and `request_user_input` when available for skip-plans and scope-creep splits; otherwise ask the required question directly. Draft closing comments and wait for explicit approval before posting. Relay the teammate's block content verbatim — don't re-summarise it thin.

## Merge (lead only)

On the teammate's merge-ready report, re-verify independently before acting — trust but verify, the evidence may be a tick stale:

For standard-tier repos, build a concise review-audit HTML artifact before merge, with each comment's file/line, disposition, driver (`real`, `hygiene`, `bot-nit`, or `no-change`), exact GitHub comment link, and fix commit. Surface bot-nit changes up front and wait for User's approval. For personal-tier repos, merge without this pre-merge gate and provide the audit afterwards only when it adds value.

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
6. Stop the recurring monitor and release the teammate with a short `send_message` so its transcript closes cleanly.

When the only remaining requirement is a human/code-owner approval, arm squash auto-merge with `gh pr merge <n> --repo <owner>/<repo> --squash --auto --delete-branch` after any standard-tier audit approval. Confirm `autoMergeRequest.mergeMethod == SQUASH`. Disable auto-merge before handling any new comment, then return through the normal gates. Never use `--admin`.

## Closing comments on linked issues (lead, User-gated)

Mandatory after a merge when the PR body linked issues (`Closes #N` / `Fixes #N` / `Resolves #N`). GitHub auto-closes without context; the comment supplies it.

1. Draft 3–6 tight lines per issue: root cause as it relates to the issue's symptom, the fix, PR link + merge SHA, and an explicit retest ask (tagging the reporter) when a platform couldn't be verified locally.
2. Draft the exact closing comment as a standalone approval artifact. If Plan mode is active, put it in the current plan artifact; otherwise show it directly and stop for explicit approval. Format:

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
- **Repository PR templates are mandatory.** If a supported template exists, keep every section in its original order and fill it in. Append custom headers or sections only after the full template; never replace, reorder, or interleave the template content.
- **PR descriptions speak as User, the author — never as the agent.** Fill author-facing template answers in first person and do not narrate “User,” the conversation, or agent actions. If an answer is not established by repository, issue, plan, or session evidence, ask User and wait before creating or updating the PR; never invent personal context or approval history. See `references/create.md`.
- **One working-tree owner.** In repos where the lead and teammate share a single working tree, the teammate is the sole editor/committer of *files* for the PR's duration; the lead does not edit, commit, or push source files while the teammate is live. If the lead has a fix, hand it to the teammate as a spec. Two exceptions are head-neutral and safe for the lead: editing the **PR description/title** (`gh pr edit`, no commit, no head move) and the merge itself. Before a body edit, diff the live PR description against the local body so user-uploaded images/videos or reviewer edits are preserved.
- Re-opened threads go to User in every mode and tier — no judgment call absorbs them.
- **Resolve a thread as soon as it's dealt with, and that includes a human reviewer's.** Reply with what changed (or why nothing did), then resolve, in the same pass. Holding a human's answered thread open "for them to close" reads as politeness but just parks the PR — `required_review_thread_resolution` makes every open thread a merge blocker. The reply is the record; the sign-off footer invites them to unresolve if they disagree, and a **re-opened** thread is the one that escalates.
- A new comment whose fix would reverse an earlier accepted disposition is an escalation to the lead, not a self-serve revert.
- If User manually changes PR state (ready, approved, merged), treat it as normal takeover: stop the teammate and monitoring, sync safely, and wrap up. Do not fight the change.
- Convention deviations require User's explicit override, whether the diff already deviates or a suggested fix would introduce the deviation.
- Draft → ready: **standard tier** after 3 consecutive clean ticks (5-minute ticks); **personal tier** after the bots' first review pass has landed + resolved and the next tick has no new comments (CI green) — no 3-tick streak, no idle wait. Definitions live in `autopilot-loop.md`.
- Before draft→ready, the lead runs the full local test suite. Only a truly docs-only diff may waive it; scoped tests do not substitute for the full gate.
- Squash everywhere; a repo that can't squash triggers one User question, persisted to memory.
- **Hard cap: 3 bot-driven review/fix rounds total per PR run.** A round is one bot-feedback batch that causes code/docs changes and a new head. **Count rounds by the head the bots reviewed, not by how many commits it took to answer them** — read `commit_id` on each review object (`gh api repos/<o>/<r>/pulls/<n>/reviews --jq '.[]|"\(.user.login) \(.commit_id[0:10])"'`). Three bots reviewing head A, each fix landing as its own commit, is **one** round. Getting this wrong retires the cap early and ships the review-driven fixes with no bot having read them — the highest-risk content in the PR. After round 3, finish that batch, run the full gates, stop requesting bots, resolve non-blocking late suggestions with evidence, and move to merge. A late critical/security/data-loss finding goes to User rather than silently starting round 4. Unsolicited feedback is still read and triaged.
- Bot silence is not approval before the cap. Explicit requests are also capped at 3 per bot; after either cap is spent, record the last-covered head and proceed without forcing another pass.
- Gates are mode-routed, never skipped: direct mode → User, delegated mode → lead per the authority table.
- The old `/pr-autopilot`, `/pr-resolve-comments`, and `/create-pr-autopilot` entry points all live here now; route their asks through scenario routing.
