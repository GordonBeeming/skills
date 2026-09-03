---
name: review-branch
description: >
  Iterative, in-the-loop, expert-panel review of the branch you're working on versus the default
  branch. Use when the user says "review branch", "/review-branch", "review my changes", "harden this
  change", "is this ready to merge", or wants a change reviewed from every angle (bugs, security,
  SRE/observability, conventions, code-hygiene, and more) and kept hardening until it's bulletproof.
  Auto-detects the diff source (shunt siding, GitButler workspace, plain git branch, or a remote PR),
  fans out a panel of expert subagents, verifies findings, produces a branded HTML artifact, then
  gates every round of fixes behind a fresh plan the user approves. Drives review → plan → implement →
  commit → re-review, one iteration at a time, until the user stops. Not for fixing existing PR review
  comments (use the pull-request skill) or single-pass PR sign-off (use review-pr) unless asked.
---

# Skill: review-branch

## Purpose

Review the code on the current working branch against the default branch from every relevant angle,
then keep hardening it — one approved iteration at a time — until it is bulletproof. Findings are tied
to behaviour and exact `file:line` references, never vibes. The user stays in the loop: **no edit
happens without an approved plan**, and re-review is recommended but never forced.

Done when a full pass yields no confirmed finding at or above the current bar (default: ≥ Medium) and
the escalated verifications pass — **or** the user says stop.

## Operating principle

This is an **interactive, multi-turn loop**, not a one-shot. Each iteration is: resolve → review →
verify → artifact → **fresh plan (approval gate)** → implement → commit → recommend re-run. Never
collapse the gate: reviewing and reporting is autonomous; changing code is not.

Empirical bias (Cal): a finding that claims runtime behaviour gets *run*, not reasoned about, when the
cost of being wrong is real. "Ran X, got Y" beats "should be fine".

**Fix, don't defer — this is the whole point of the skill.** The default outcome for every confirmed
finding at or above the bar is a change made *now, on this branch*. This skill exists to enforce higher
quality, so it must never, on its own, propose "leave it for another PR", "track as a follow-up issue",
"out of scope for this change", or "land the rest as follow-ups". That posture is the failure it's
built to prevent. Deferral is a decision **only the user makes**, explicitly, during plan review — never
a recommendation the skill offers first. If a finding looks genuinely out of scope, still put the fix in
the plan and *let the user choose to drop it*; don't pre-decide it away. Do not declare the change
done/bulletproof while any confirmed ≥bar finding is unaddressed.

## Inputs

Infer, don't interrogate:

- What to review — defaults to the auto-detected current change (see `references/diff-resolution.md`).
- A PR URL / branch / siding name, if the user names one.
- Review focus, if given (e.g. "focus on the auth path", "just security this round").
- The bar for what's worth reporting/fixing (default ≥ Medium confirmed).

Ask (via `AskUserQuestion`) only when the diff source is genuinely ambiguous — most commonly **several
shunt sidings running at once** — or when the user's focus can't be inferred.

## The loop

### 1. Resolve the diff
Follow `references/diff-resolution.md` exactly. Detection order: **shunt siding → GitButler workspace
→ plain git branch → remote PR**. Print a one-line scope summary (base, files, +/- lines, siding) and
proceed unless genuinely ambiguous.

### 2. Build shared context (cheap, once per pass)
- Collect the relevant `CLAUDE.md` / `AGENTS.md` **paths** (repo root + each touched directory) — pass
  paths to the experts, don't inline-dump the contents into every one.
- Produce a short plain-language summary of what the change does.
- **Triage** the diff against `references/triage.md` to select the dynamic experts for this pass.

### 3. Run the expert panel (parallel subagents)
Spawn the always-on experts plus the triage-selected ones **in parallel** (one message, multiple
`Agent` calls). Always-on: **correctness, security, sre-observability, conventions, code-hygiene.**
Each subagent is handed its persona file from `references/experts/<name>.md`, the diff, the change
summary, the CLAUDE.md paths, and the finding schema from `references/state.md`.

Finder job is **coverage, not filtering** — give every expert this instruction verbatim:

> Report every issue you find, including ones you are uncertain about or consider low-severity. Do not
> filter for importance or confidence at this stage — a separate verification step will do that. Your
> goal here is coverage: it is better to surface a finding that later gets filtered out than to
> silently drop a real bug. For each finding, include your confidence level and an estimated severity
> so a downstream filter can rank them.

Experts must **read the surrounding base-branch code before judging** — a diff line alone is not enough
context to call a bug.

**Confirm every expert actually returned an array before synthesising.** A subagent going idle without
delivering its findings is a silent failure: nothing errors, and the pass looks complete while an angle
was never covered. Check each expert's output arrived; for any that didn't, request it once, and if it
still doesn't come, **review that angle directly** rather than shipping reduced coverage. Either way,
state in the artifact and the final response which experts actually reported — a review that reads like
nine perspectives when it was one is worse than an honestly narrow review.

**Expect to chase roughly half of them, and reconcile on a schedule rather than on suspicion.** This is
the common case, not an edge case: a panel routinely has several experts finish their work and end their
turn without ever calling SendMessage. So don't wait until the findings feel thin to notice. Write down
the spawn list, and before synthesising anything, tick off each name against a delivery you actually
received. `ListAgents` is the check — an expert sitting `idle` with nothing in your inbox has finished
and not reported.

The trap is that **an idle notification looks like a completion signal and is not one.** It says the turn
ended, not that the work arrived, and the two are easy to conflate when several land together. A chased
expert usually replies with the full array immediately and often says it sent once already, so the cost
of asking is one message and the cost of not asking is a silently missing angle.

When one still doesn't deliver after a single re-request, cover it yourself and say so by name in the
artifact — "correctness: covered by the lead" is honest and useful; a roster implying nine independent
readings when four came from the lead is neither.

### 4. Verify (precision gate)
Follow `references/verification.md`: dedup across experts, score each finding 0–100 for real-vs-false-
positive, re-check any CLAUDE.md-derived finding against the actual rule text, and **escalate to
running it** (build / targeted test / exercise the app — via `shunt-dev run` inside a siding) when a
finding needs behavioural proof or sits on a critical/production path, or when the user asks. Keep
findings at or above the bar; route the rest to a filtered appendix — **nothing is silently dropped.**

### 5. Synthesize the artifact
Build one branded, self-contained HTML artifact per iteration per `references/artifact.md`. Persist the
structured `findings.json` + freeform progress notes per `references/state.md` so re-runs show
fixed / regressed / newly-found deltas. Follow the global visual-QA loop and run the **humanizer** pass
on all prose before handing it over.

### 6. Present a fresh clean plan (approval gate)
From the **confirmed** findings, write a brand-new plan of the changes you recommend — never reuse a
prior plan. Enter plan mode (`EnterPlanMode` is deferred — load via `ToolSearch` `select:EnterPlanMode`),
write the plan file, and present it with `ExitPlanMode`. This is the only channel for proposing edits.

The plan proposes **a concrete fix for every confirmed finding at or above the bar** — actual changes to
make on this branch, grouped by severity, each with the file(s) and the intended edit. It is a plan of
*changes that will be made*, not a menu of suggestions to consider. The user drops/keeps/tweaks each
item; anything the user chooses not to fix is deferred by *their* decision and recorded as such. Do not
seed the plan with "defer to a follow-up PR", "raise a tracking issue", or "out of scope" framing — if
the user wants that, they'll say so. A plan that proposes deferring confirmed findings instead of fixing
them has failed its job; rewrite it to propose the fixes.

### 7. Implement → commit → recommend re-run
On approval, implement exactly the approved changes. Commit per the git rules:
- **Main GitButler repo** → `but` (GitButler CLI), signed, on a `gb/` branch.
- **Inside a shunt siding worktree** → `shunt git` (the siding branch already carries its prefix).

Then recommend whether to re-review based on change size, the severity of what was touched, and whether
fixes landed in risky areas — and let the user decide. Loop back to step 1 for the next iteration.

The change is only "bulletproof / done" when a full pass leaves **no confirmed finding at or above the
bar** (default ≥ Medium) and the escalated verifications pass — or the user explicitly stops. Confirmed
findings the user chose to drop count as *user-deferred*, recorded in `progress.md`, not as "resolved".
Never announce the branch as clean, ready, or bulletproof while confirmed ≥bar findings sit unfixed by
the skill's own recommendation.

## Boundaries

- **Never edit code outside an approved plan.** Review and artifact generation are autonomous; edits
  are gated every single pass, with no carveout for "trivial" fixes.
- **Never unilaterally defer a confirmed finding.** "Leave for another PR", "raise a follow-up issue",
  "out of scope", "land the rest as follow-ups" are not outcomes the skill proposes — only outcomes the
  user chooses. The default is to fix it now, on this branch.
- Don't post to GitHub (PR comments/reviews) unless explicitly asked.
- Don't route siding commits through GitButler, and don't route main-repo commits through raw git.
- Never bypass commit signing or use `--no-verify`; stop and ask if signing fails.
- For hard-to-reverse or shared-system actions (push, force-push, PR posting), confirm first.
- Don't treat a green check as proof — connect every verification back to the behaviour it proves.

## Output (final response each iteration)

- Artifact path.
- Verdict + bulletproofness score and its trend vs the previous iteration.
- Top confirmed findings with `file:line` references.
- What was verified by running, with the commands and their results (including skips/failures).
- The recommendation on whether to re-review, and why.

## Extending this skill

- Add a review angle by dropping a `references/experts/<name>.md` persona file and wiring it into
  `references/triage.md` — no change to this file needed.
- Tune thresholds/rosters in the reference files, or per-repo via a `.review-branch.md` (falling back
  to `CLAUDE.md`) in the target repo.
- Per the global skills-self-improve rule: when a pass surfaces a gotcha (a detection edge case, a
  false-positive pattern, a missing expert), update the relevant reference file so the next run is
  better.
