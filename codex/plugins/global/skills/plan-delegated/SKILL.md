---
name: plan-delegated
description: >
  Plan a piece of work, get the plan approved in full plan mode (team structure table up top), then
  delegate implementation to model-right-sized teammates, review their work with feedback rounds, and
  commit. Use when User says "$plan-delegated", "plan and delegate", "plan this then hand it to the
  team", or "team-plan this". The work source is anything — a GitHub issue/PR URL, a conversation
  description, a pasted spec; nothing GitHub-specific is assumed. Do NOT auto-trigger on a bare GitHub
  URL (that stays with github-issue-planner); this skill is for when User explicitly wants the
  delegated-team working style.
---

# Skill: plan-delegated

## Goal

Complete when User has approved a standalone plan, the approved model has implemented each
workstream, the lead has reviewed and independently validated the result, and the lead has committed
the accepted changes. The lead plans, reviews, validates, and owns version control; it does not write
the feature code. Teammates do not commit.

## Authorization

Planning authorizes repository inspection and non-mutating research. Do not start implementation
until User approves the plan. Approval authorizes the planned local branch, implementation, tests,
review rounds, and commit. Require separate confirmation for a PR, other external writes,
destructive actions, or material scope expansion.

**Skipping the whole skill is a different decision, and it must be announced.** When the work is below
the delegation threshold (a single-line change, a comment reply, an issue creation with its own flow)
and you present a plain plan without this skill, the **first line** of that plan must be a 🔥 note
saying you're skipping `$plan-delegated` and why — e.g.
`🔥 Skipping $plan-delegated: single-line change + one test assertion — below the delegation threshold.`
Always the first line, never buried at the bottom.

## Workflow

### 1. Capture the work

Take the work in whatever form it arrives:

- GitHub issue or PR URL → fetch it (`gh issue view` / `gh pr view` with comments) for context, and
  carry the URL through to the plan and any commits/PRs.
- Conversation words / a voice-dump of requirements → distill them, quoting the load-bearing phrases.
- A pasted spec or doc → read it fully.

Record the source in the plan's Context section so the plan stands alone without this transcript.
Make no assumptions about scope beyond what the source says — ambiguities, and any conflict with an
established convention (see the convention-override hard rule), become questions at the plan gate
(`request_user_input` in Plan mode when available), not silent decisions.

### 2. Research before planning

- Run the repo-entry checks the global rules require: shunt check (`shunt-dev active`), and
  `but clean --pull` when the repo is GitButler-managed.
- Read the affected code: Explore agents for breadth, direct reads for the files the work will touch.
  A plan built on unread code is worse than no plan — same bar as `$github-issue-planner`.
- Note the repo's test commands, conventions files (`AGENTS.md` and any applicable `CLAUDE.md`), and
  any feature-flag or process skills the work must follow.

### 3. Design the team

Break the work into workstreams, then staff them:

- **Exclusive file ownership per concurrent wave.** Two teammates never write the same file at the
  same time — concurrent agents share one working tree. Workstreams that need the same file run in
  sequence, with a lead checkpoint commit between waves.
- **Preserve an explicit model request.** Otherwise choose by workstream shape: Luna
  (`gpt-5.6-luna`) for a clear, bounded implementation with a precise spec and runnable checks; Terra
  (`gpt-5.6-terra`) when implementation still needs non-trivial design judgment; Sol
  (`gpt-5.6-sol`) or the session model for ambiguous, cross-cutting, or high-consequence work. The
  lead stays on the session model. When the choice is not explicit, every non-Luna row must end its
  "What they'll do" cell with `Justification: {reason}` tied to these criteria.
- **Resolve the runner before asking User to approve the plan.** A model name in the table is a
  promise, not a preference. Use the first runner that can pin the exact model:
  1. A teammate/agent tool with an explicit model field.
  2. Otherwise, the native CLI: `codex exec -m <model-id> -C <repo> --json -o <report> -`, with the
     workstream prompt supplied on stdin. Capture the JSONL output and its `thread.started` id in the
     scratchpad so feedback can resume the same teammate.
  If neither runner can guarantee the approved model, stop at the plan gate and ask User whether
  to approve a named fallback. Never silently inherit the lead's model, label a default agent as
  Luna, or claim the requested model was unavailable merely because `spawn_agent` lacks a model
  field.
- Write a spec file per workstream (scratchpad directory) plus one shared-context file covering the
  repo map, conventions, hard rules (no commits, no app launches, file ownership), and the
  verification commands every teammate must run before reporting done.

### 4. Plan mode — mandatory gate

Enter Codex Plan mode, write the plan artifact, present it, and wait for approval. Use
`request_user_input` for the approval gate when available. Plan sections
in this order:

1. **Team structure** — the first thing in the plan. A table:

   | Team member | Model | Runner | What they'll do |
   | ----------- | ----- | ------ | --------------- |
   | ws-a-backend | Luna (`gpt-5.6-luna`) | `codex exec` | Rust commands + API wrappers for X |
   | ws-b-tricky | Sol (`gpt-5.6-sol`) | Agent tool | Concurrency-heavy scheduler. Justification: {why Luna can't do this one even with the spec + lead review} |

   One row per teammate, then a line or two on sequencing: what runs in parallel, what waits, and why.
   Non-Luna rows need the `Justification:` suffix unless User explicitly selected the model.
2. **Context** — the work source (URL or distilled transcript), what the research found.
3. **Approach** — the strategy; name real alternatives briefly if they exist.
4. **Workstream specs** — per teammate: owned files, scope, verification commands, what they report.
5. **Testing / verification** — the suites, plus the end-to-end behavior checks the lead runs after
   integration (drive the real app/flow, not just the tests — the `verify` skill's spirit).
6. **Review strategy** — recommend whether this work warrants a `$review-branch` expert-panel pass
   before commit, with a one-line reason. User decides at approval time. Reference that skill by
   name only; it evolves independently.
7. **Risks / open questions.**
8. **Glossary** — alphabetical, every acronym and domain term used in the plan, last section.

Run the humanizer pass on the plan prose before presenting it.

### 5. Delegate on approval

Approval is the go — start immediately within the authorization above.

- Create the branch first (GitButler: `but branch new gb/<descriptive-name>`).
- Start each teammate with the approved model and runner. When the agent tool exposes a model field,
  use it. Otherwise run `codex exec -m <approved-model-id> -C <repo> --json -o <report> -` and supply
  the prompt on stdin. The prompt points at the shared-context and workstream spec files and restates:
  owned files only, no commits or git write commands, no app launches, and end with files changed,
  test/typecheck results, and anything skipped or uncertain. Treat an unavailable-model or
  entitlement error as a blocked workstream; do not retry on the default model.
- Start every teammate in a parallel wave together, using its approved runner. Arm a stall monitor
  for long builds (working-tree hash check every 5–10 minutes) and stop it when the wave completes.
- Between waves that touch the same files: lead reviews, then checkpoint-commits via `but` so the next
  wave starts from committed state.

### 6. Review and feed back

For every workstream, before accepting it:

- Read the full diff. Check it against the spec, the repo's conventions, and the global code-quality
  rules.
- Re-run the verification suites yourself — a teammate's green report is necessary, not sufficient.
- Send amendments back to the same teammate (specific: the problem, the fix shape, the files) and
  re-review until the workstream passes. Use `send_message` for agent-tool teammates. For CLI
  teammates, use `codex exec resume -m <same-model-id> <thread-id> -` with the feedback on stdin.
  Never start a fresh teammate for a feedback round when the existing thread can resume.
- Escalate to User only for genuine scope decisions a reviewer can't make.

After all workstreams land: integration-verify end to end (run the real thing and observe the
behaviors the plan promised), in a scratch/e2e environment where the repo has that convention —
never against real user data.

### 7. Optional expert-panel review

If the approved plan said yes (or User asks for it now), invoke the `review-branch` skill and drive
its loop before finalizing.

### 8. Commit

The lead commits, per the git rules: GitButler (`but commit`) on the `gb/` branch in a main repo,
`shunt git` inside a siding. One logical commit per workstream where that keeps the history readable.
Stop after committing — PR creation stays with the pull-request skill unless User asks for it.

Close with a summary: what shipped per workstream, verification evidence (commands + observed
results), feedback rounds per teammate, and anything deferred with User's decision noted.

## Hard rules

- File ownership is exclusive within a wave; shared files force sequencing.
- The lead independently re-runs verification before accepting any workstream.
- All testing of running apps happens in scratch/e2e environments, never User's real files.
- Escalation to User is for scope decisions, not for work a review round can fix.
- The approved teammate model is enforced by the runner. A silent fallback or unverified inherited
  model invalidates that workstream and must be rerun with the approved model.
- **A convention deviation is an explicit, User-selected override — never silent.** If the work
  would break an established convention, standard design, ADR, or prior decision (a naming format, an
  architectural pattern, a documented rule), do not fold the deviation into the plan on your own —
  *even when User's own request implies it*, because he may not have spotted the conflict. Surface
  it at the plan gate with `request_user_input`: name the convention, the deviation, and what breaking
  it costs, with an explicit "override the convention" option. Carry the deviation into the plan only
  if User picks the override; otherwise the plan conforms to the convention.
