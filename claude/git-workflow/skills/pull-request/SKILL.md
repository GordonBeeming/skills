---
name: pull-request
description: "Own the whole PR cycle: commit, create a draft PR with Copilot review, resolve feedback through at most 3 bot-driven review/fix rounds with a delegated Sonnet teammate, publish, and merge after lead verification. Use when User says '/pull-request', 'PR autopilot', 'pull request autopilot', 'create autopilot for this work', or gives a PR URL wanting comments resolved ('resolve PR comments', 'fix PR feedback', 'address review comments'). Not for bare 'create a PR' / 'ship it' (normal draft-PR flow via the gitbutler skill), reviewing other people's PRs (review-pr / pr-review-backlog), or Dependabot batches (dependabot-review)."
---

# Skill: pull-request

## Purpose

One skill for the produce-and-merge PR cycle. The lead (main session) routes the scenario, creates the PR when needed, and delegates the watch/resolve loop to a Sonnet teammate; the teammate iterates with the review bots (draft first, then published) and the lead handles escalations, does the merge, and posts closing comments. User stays in the loop only for the decisions that are genuinely his.

Reference files carry the procedures:

- `references/create.md` — commit + draft PR + Copilot review request (lead runs this)
- `references/autopilot-loop.md` — the teammate's tick loop, draft and published phases
- `references/resolve-comments.md` — triage/fix/reply/resolve, with mode-routed decision gates
- `references/lead-wake-cycle.md` — the lead's ~10-minute poll: CI-read mechanics, tick math, keeping
  User posted
- `references/merge.md` — the review-audit gate, direct-merge steps, auto-merge arming
- `references/closing-comments.md` — the User-gated closing-comment template and posting flow

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

   **Check `autoMergeRequest` before spawning anything** (`gh pr view <n> --json autoMergeRequest`). A PR
   handed to this skill may already have auto-merge armed from before the run. If it's armed, the merge
   is no longer the lead's to time: GitHub fires it the instant the last protection clears, and
   *resolving the threads is usually what clears it*. "Pre-armed auto-merge" in `references/merge.md`
   covers what that changes; the short version is that the standard-tier audit gets produced **before**
   the resolve round rather than after it, because afterwards there may be no gap left to produce it in.
2. **No PR yet** for the current work → run `references/create.md` (verify → commit → draft PR → Copilot review request), then spawn the teammate.
3. **Ambiguous** → `AskUserQuestion` with: PRs already mentioned/created in this conversation, **"Create a pull request for `<current branch>`"**, "Discover my open PRs" (then `gh pr list --author @me --state open --json url,title,number` and a follow-up question), "I'll paste a URL", and cancel. Never auto-discover or start a loop without User confirming the target.

## Spawn the teammate

One named Sonnet teammate per PR: `Agent(name: "pr-autopilot-<n>", model: "sonnet")` — **once**. To nudge, ack, or reply afterwards, use `SendMessage(to: "pr-autopilot-<n>")`, never a second `Agent(name: …)` call: re-invoking Agent with the same name spawns a *fresh contextless* agent (`pr-autopilot-<n>-2`), stranding the real teammate and needing a `TaskStop` to clean up. The prompt must carry:

- The PR URL/number and instruction to follow `references/autopilot-loop.md` (give the absolute path) with `references/resolve-comments.md` in delegated mode.
- The repo tier (personal/standard) — it changes the lead's answers, and signing checks on personal.
- **Which git system the repo uses, named explicitly** — resolve it before spawning (a `.git/gitbutler` marker means GitButler-managed, a shunt siding branch/config means shunt, otherwise plain git), and state it in the prompt. The references' `but` commands are the GitButler case only; a repo with no `.git/gitbutler` marker is plain git and `but` fails outright there. A `gb/`-prefixed branch name is a convention, not evidence of GitButler, so never let the teammate infer the system from the branch.
- Repo git rules: for GitButler — `but` only, existing `gb/` branch, no raw `git commit`, `but clean --pull` after every push. For plain git — raw `git add`/`commit`/`push` on the existing branch, no `but`, no sync step on the teammate's side. Both: no signing changes, no co-author trailers, SSH-agent approval failures are report-and-stop.
- A one-paragraph summary of the change so review replies are informed, plus any design decisions a bot might wrongly flag (e.g. offsets that must stay full-line).
- The reminder: never merge; use the tier-specific ready threshold; stop explicit bot requests after 3 total bot-driven review/fix rounds; escalate via SendMessage and keep ticking while waiting.

Then arm the lead's own wake cycle at **~10 minutes**, phase-aligned to the teammate's 5-minute ticks, and keep User posted with the PR link on every wake. The CI-read mechanics (avoiding false alarms from superseded check-runs), the tick-timing math, and the stalled-teammate recovery rule live in `references/lead-wake-cycle.md` — read it before the first wake fires.

**The teammate cannot pace itself — the lead's nudges are the clock.** A subagent ends its turn after
reporting a tick and emits an idle notification; it does not sleep and wake on its own. Telling it to
`sleep 300` in-turn and loop does not change this, so don't spend a message trying. Plan for one nudge per
tick from the lead, and read an idle notification as "tick complete, awaiting the next one" rather than as
a stall.

That changes what the lead's cadence is *for*. Nudging a PR where nothing can move — every bot has
answered, threads are zero, and the only remaining gate is a human approval — buys nothing but turns.
When the PR reaches that state, stand the teammate down (`TaskStop` it; a stood-down teammate keeps
emitting idle notifications otherwise) and watch the PR directly. Standard tier's 3-clean-tick streak
exists to let bot feedback settle, not to mark time against a human: once all bots have landed clean on
the final head, further ticks observe an unchanging PR.

## Escalation authority (the lead's decision table)

| Escalation from teammate | Lead decides alone | Goes to User |
| --- | --- | --- |
| Question-only reply, answer clearly established in session/PR context | ✅ | Unknown answer → User |
| Merge-conflict resolution, mechanical/non-overlapping | ✅ | Ambiguous → User |
| Scope-creep issue creation | Personal tier: ✅ (judgment) | Standard tier: always (plan-mode gate) |
| Human skip-plans | Personal tier: ✅ (judgment; a human contradicting the task's explicit goal still → User) | Standard tier: always |
| Re-opened threads (sign-off footer detected) | — | Always, both tiers — hard rule |
| Convention / standard-design / ADR deviation (a comment's fix would break one, or the diff already does) | — | Always, both tiers — explicit `AskUserQuestion` override |
| Merge method unknown / squash unavailable | — | Once; persist to repo memory |
| CI red and teammate's fix failed | May direct one retry strategy | Repeated failure → User |
| 3-hour cap reached | — | User decides whether to restart |

When forwarding to User, use the gate form the reference specifies: plan mode for skip-plans, scope-creep splits, and closing comments; `AskUserQuestion` for the rest. Relay the teammate's block content verbatim — don't re-summarise it thin.

## Merge (lead only)

On the teammate's merge-ready report, re-verify independently before acting — trust but verify, the
evidence may be a tick stale. Full procedure in `references/merge.md`; the shape:

- **Standard tier: the review-audit HTML doc is mandatory before merge** — one row per review comment
  with disposition and a driver tag (`real` / `hygiene` / `bot-nit` / `no-change`), delivered to User
  even when every check is green. **Personal tier:** merge first, deliver the audit after (informational).
- **Human code-owner approval required** (the usual case on protected main) → arm auto-merge the moment
  the loop's work is done; don't wait on a separate User sign-off, since the required approval *is* the
  human-eye gate.
- **No human approval required** → direct-merge path: the lead re-verifies threads/checks itself and
  presses `gh pr merge --squash --delete-branch`. Never `--admin`, never `--no-verify`-style bypasses.
- Auto-merge is `--auto`, never the bypass flag; disable it the instant a new comment/review lands, work
  the comment, then re-arm.
- After any merge: wait for propagation before `but clean --pull`, stop the backstop Monitor, release the
  teammate.

## Closing comments on linked issues (lead, User-gated)

Mandatory after a merge when the PR body linked issues (`Closes #N` / `Fixes #N` / `Resolves #N`) —
GitHub auto-closes without context, so the comment supplies it. Draft 3–6 tight lines per issue (root
cause, fix, PR link + merge SHA, retest ask), gate the exact wording through a fresh `EnterPlanMode`, then
post via `gh issue comment` on approval. The gate holds even when the wording looks obviously fine — only
User knows whether to ping the reporter or skip an issue. Template and posting details in
`references/closing-comments.md`.

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
- **One working-tree owner.** In repos where the lead and teammate share a single working tree (e.g. GitButler in the main repo — the teammate commits to the same checkout the lead sits in), the teammate is the sole editor/committer of *files* for the PR's duration; the lead does not edit, commit, or push source files while the teammate is live. If the lead has a fix, it hands it to the teammate as a spec, not a commit — lead and teammate editing the same file concurrently (e.g. after a "hold" that crosses in flight) risks corruption. Two exceptions are head-neutral and safe for the lead: editing the **PR description/title** (`gh pr edit`, no commit, no head move) and the merge itself. Proactively refresh the PR description after each scope change so a bot doesn't have to flag it stale (bots flag a stale description repeatedly otherwise). **Never regenerate the description from a local file without first diffing it against the live body** — User (or a reviewer) may have added content directly on GitHub, most commonly `user-attachments` video/image uploads, and a body-file overwrite silently deletes it. Fold any live-body additions into the canonical body file before editing, and verify the attachment links survived after.
- Re-opened threads go to User in every mode and tier — no judgment call absorbs them.
- **Resolve a thread as soon as it's dealt with, and that includes a human reviewer's.** Reply with what changed (or why nothing did), then resolve, in the same pass. There is no tier of comment that gets fixed-and-answered but left open out of deference — holding a human's answered thread open "for them to close" reads as politeness but just parks the PR, because `required_review_thread_resolution` makes every open thread a merge blocker and drags the reviewer back to click resolve on something already handled. The reply is the record; the sign-off footer already invites them to unresolve if they disagree, and a **re-opened** thread is the one that escalates.
- **A "don't fix that" ruling that arrives after the fix is already pushed must become an explicit revert
  commit, or it isn't real.** Lead rulings and teammate pushes cross in flight constantly, so a decline
  routinely lands on a comment the teammate has already committed. Reverting the change in the working tree
  without committing it is the trap: the branch merges *with* the change while the tree is left holding an
  uncommitted revert, so main and the working copy silently disagree and the author is left with a mystery
  diff after the merge. On receiving a decline, the teammate checks whether the change is already pushed —
  if it is, it either commits the revert or says plainly that the fix has shipped and asks whether to revert
  it. The lead re-checks `git status` after the merge and reconciles anything left behind.
- A fix that would reverse an earlier accepted disposition on the same PR (undoing a previously-fixed thread's change to satisfy a new comment) is an escalation to the lead, never a self-serve commit — the right answer is usually a different mechanism that satisfies both threads (e.g. solve a layout complaint in CSS rather than un-hiding markup an earlier thread hid).
- **Manual takeover is normal, not an anomaly.** If the PR state changes outside the loop (undrafted, approved, merged), check the timeline actor before reacting: when it's User, he's taken over — stand the teammate down, stop the backstop monitor, `but clean --pull`, and wrap up with the final summary. Only an actor that isn't User (or the teammate itself violating its gate) is an incident.
- **Convention deviations need User's explicit override — both directions, both tiers.** If
  implementing a review comment would break an established convention, standard design, ADR, or prior
  decision, *or* a reviewer flags that the diff already breaks one (a naming/format/pattern
  inconsistency), it is never an auto-fix and never an auto-skip. Surface it to User via
  `AskUserQuestion` — name the convention, the deviation, and the cost — with an explicit "override the
  convention" option; conform to the convention unless he selects override. He may not have noticed his
  own request conflicts with a convention (a permission string shipped snake_case against the
  kebab-case convention on this repo and wasn't caught until review). The teammate escalates these to
  the lead rather than deciding; the lead runs the question.
- Draft → ready: **standard tier** after 3 consecutive clean ticks (5-minute ticks); **personal tier** after the bots' first review pass has landed + resolved and the next tick has no new comments (CI green) — no 3-tick streak, no idle wait. Definitions live in `autopilot-loop.md`. Once the 3-round request cap is spent, a clean tick requires only *no new feedback* — bot echoes on the current head can't be a precondition when nothing may be requested anymore, or the streak deadlocks waiting for responses that were never asked for.
- **Which checks are draft-gated is repo-specific — read the actual conclusions, don't assume.** CodeRabbit
  reliably skips drafts, but a repo's own workflows may run and pass on a draft (`triage`, `verify`,
  `risk-label`) or skip for a reason unrelated to draft status: a job gated
  `if: github.event_name != 'pull_request'` shows SKIPPED on every PR forever and never becomes meaningful
  on the ready-flip. Recording either as "will run once published" produces a phantom pending check the
  streak waits on, and worse, hides a genuine failure behind an expected-skip label. Take the conclusion
  from `gh pr checks` and, when a skip looks load-bearing, read the workflow's `if:` rather than inferring
  it from draft state.
- **Full local test suite before draft→ready — lead-run, always, no scoping.** Before any PR is marked ready, the lead runs the *entire* local test suite (e.g. `dotnet test <solution>` / the repo's full test command), not a scoped subset, and confirms it green. Run it **even when the change looks narrow and you're sure only a few projects are affected** — on a larger system the real blast radius is never accurately predictable from the diff (shared constants, expansion logic, DI, source-gens, and integration wiring get hit by "unrelated" changes), so scoped test selection routinely misses regressions. A green full run gates the ready-flip; the teammate never self-flips to ready on its own tick without the lead's full-suite green-light. CI is a backstop, not a substitute — catch it locally first. **One documented exception (User-approved): diffs the suite cannot reach.** The gate is waived when *no changed file is reachable by the build or the tests* — not when the diff merely "looks like docs". Reach, not file extension, is the test. Markdown skills, READMEs and ADRs qualify; so does a standalone script that no project compiles, packages, or imports, and that no test invokes. A `.py` sitting beside a `SKILL.md` under `.agents/` is as unreachable by a .NET solution as the markdown next to it, and running a multi-hundred-project suite for it burns minutes and CPU to prove something the dependency graph already answers.

**Demonstrate the reach is zero — don't assert it.** The waiver needs evidence, and it's two cheap greps: the path appears in no project/build file (`grep -rl <name> --include=*.csproj --include=*.props --include=*.targets --include=package.json .`), and nothing under the test tree imports or shells out to it. Both empty → waived, and say so in the green-light with the commands you ran. Either non-empty → run the full suite.

That evidence requirement is what keeps this from becoming the rationalization the rule above warns about. "I'm sure only a few projects are affected" stays banned; "this file is referenced by nothing, here's the query" is a fact. Nothing here shrinks a run that does happen — the waiver skips the suite entirely for a zero-reach diff, and "no scoping" still governs every diff where the suite runs at all. **A repo with no test suite at all** (no test runner, no test files — some worker/config/infra repos are a single source file plus a manifest) is a third case, distinct from both: there is nothing to run, so name the repo's actual verification mechanism instead and state plainly that it stands in for the suite. For a Cloudflare Worker that means exercising it under `wrangler dev` and asserting on the real emitted output; for others it may be a manual smoke run. Say so out loud in the ready green-light — an unspoken skip and a reasoned substitution look identical in the log, and only one of them is honest.
- Squash everywhere; a repo that can't squash triggers one User question, persisted to memory.
- **Hard cap: 3 bot-driven review/fix rounds total per PR run.** A round is one bot-feedback batch that causes code/docs changes and a new head. **Count rounds by the head the bots reviewed, not by how many commits it took to answer them** — read `commit_id` on each review object (`gh api repos/<o>/<r>/pulls/<n>/reviews --jq '.[]|"\(.user.login) \(.commit_id[0:10])"'`). Bots answer at their own pace, so three bots reviewing head A and each fix landing as its own commit is **one** round, not three; the commit count is how the batch was answered, not how many batches arrived. Getting this wrong retires the cap early and ships the review-driven fixes with no bot having ever read them — which is the highest-risk content in the PR, since fixes are written fast and under the assumption the hard thinking is done. When the teammate's count and the lead's disagree, the `commit_id`s settle it, not seniority. After round 3, finish that batch, run the full gates, stop requesting bots, resolve non-blocking late suggestions with evidence, and move to merge. A late critical/security/data-loss finding goes to User rather than silently starting round 4. Unsolicited feedback is still read and triaged. Explicit requests are also capped at 3 per bot.
- Keep User updated on every check-in — see `references/lead-wake-cycle.md`.
- Gates are mode-routed, never skipped: direct mode → User, delegated mode → lead per the authority table.
- The old `/pr-autopilot`, `/pr-resolve-comments`, and `/create-pr-autopilot` entry points all live here now; route their asks through scenario routing.
