---
name: plan-delegated
description: >
  Plan a piece of work, get the plan approved in full plan mode (team structure table up top), then
  delegate implementation to model-right-sized teammates, review their work with feedback rounds, and
  commit. Use when User says "/plan-delegated", "plan and delegate", "plan this then hand it to the
  team", or "team-plan this". The work source is anything — a GitHub issue/PR URL, a conversation
  description, a pasted spec; nothing GitHub-specific is assumed. Do NOT auto-trigger on a bare GitHub
  URL (that stays with github-issue-planner); this skill is for when User explicitly wants the
  delegated-team working style.
---

# Skill: plan-delegated

## Purpose

One flow: research → plan (with the team design in it) → User approves → teammates build → lead
reviews and feeds back → optional expert-panel review → lead commits. The lead (this session) never
writes the feature code itself; it writes specs, reviews diffs, verifies behavior, and owns version
control. Teammates never commit.

The plan-approval gate is the point of this skill. It is never skipped — not for small work, not when
User seems to be away. If he's away, park at the gate and wait.

## Workflow

### 1. Capture the work

Take the work in whatever form it arrives:

- GitHub issue or PR URL → fetch it (`gh issue view` / `gh pr view` with comments) for context, and
  carry the URL through to the plan and any commits/PRs.
- Conversation words / a voice-dump of requirements → distill them, quoting the load-bearing phrases.
- A pasted spec or doc → read it fully.

Record the source in the plan's Context section so the plan stands alone without this transcript.
Make no assumptions about scope beyond what the source says — ambiguities become questions at the
plan gate (AskUserQuestion before ExitPlanMode), not silent decisions.

### 2. Research before planning

- Run the repo-entry checks the global rules require: shunt check (`shunt-dev active`), and
  `but clean --pull` when the repo is GitButler-managed.
- Read the affected code: Explore agents for breadth, direct reads for the files the work will touch.
  A plan built on unread code is worse than no plan — same bar as /github-plan-issue.
- Note the repo's test commands, conventions files (CLAUDE.md/AGENTS.md), and any feature-flag or
  process skills the work must follow.

### 3. Design the team

Break the work into workstreams, then staff them:

- **Exclusive file ownership per concurrent wave.** Two teammates never write the same file at the
  same time — concurrent agents share one working tree. Workstreams that need the same file run in
  sequence, with a lead checkpoint commit between waves.
- **Right-size each teammate's model:** Haiku for mechanical/repetitive edits, Sonnet for standard
  build work, Opus or the session model only where the judgment is genuinely heavy. The lead stays on
  the session model. Because the lead plans the work and reviews every diff, Sonnet is the default and
  can handle almost anything with a precise spec — reach past it rarely. **Any teammate whose model is
  not Sonnet must carry a `Justification: {reason}` at the end of its "What they'll do" cell,** naming
  what specifically Sonnet couldn't do well enough here despite the lead's spec and review. No
  justification, use Sonnet.
- Write a spec file per workstream (scratchpad directory) plus one shared-context file covering the
  repo map, conventions, hard rules (no commits, no app launches, file ownership), and the
  verification commands every teammate must run before reporting done.

### 4. Plan mode — mandatory gate

Enter full plan mode (`EnterPlanMode` is deferred — load via ToolSearch `select:EnterPlanMode`), write
the plan to the announced plan file, present with `ExitPlanMode`, and wait for approval. Plan sections
in this order:

1. **Team structure** — the first thing in the plan. A table:

   | Team member | Model | What they'll do |
   | ----------- | ----- | --------------- |
   | ws-a-backend | Sonnet | Rust commands + API wrappers for X |
   | ws-b-tricky | Opus | Concurrency-heavy scheduler. Justification: {why Sonnet can't do this one even with the spec + lead review} |

   One row per teammate, then a line or two on sequencing: what runs in parallel, what waits, and why.
   Non-Sonnet rows need the `Justification:` suffix (see the model-sizing rule above).
2. **Context** — the work source (URL or distilled transcript), what the research found.
3. **Approach** — the strategy; name real alternatives briefly if they exist.
4. **Workstream specs** — per teammate: owned files, scope, verification commands, what they report.
5. **Testing / verification** — the suites, plus the end-to-end behavior checks the lead runs after
   integration (drive the real app/flow, not just the tests — the `verify` skill's spirit).
6. **Review strategy** — recommend whether this work warrants a `/review-branch` expert-panel pass
   before commit, with a one-line reason. User decides at approval time. Reference that skill by
   name only; it evolves independently.
7. **Risks / open questions.**
8. **Glossary** — alphabetical, every acronym and domain term used in the plan, last section.

Run the humanizer pass on the plan prose before presenting it.

### 5. Delegate on approval

Approval is the go — start immediately, no second confirmation.

- Create the branch first (GitButler: `but branch new gb/<descriptive-name>`).
- Spawn each teammate with the Agent tool: `name` set to the workstream id, `model` set per the team
  table, prompt pointing at the shared-context file and their spec file. The prompt restates: owned
  files only, no commits or git write commands, no launching the app, update their task (TaskCreate
  entries exist per workstream), and end with a report of files changed, test/typecheck results, and
  anything skipped or uncertain.
- Parallel waves go out in one message (multiple Agent calls). Arm a stall monitor for long builds
  (working-tree hash check every 5–10 minutes) and stop it when the wave completes.
- Between waves that touch the same files: lead reviews, then checkpoint-commits via `but` so the next
  wave starts from committed state.

### 6. Review and feed back

For every workstream, before accepting it:

- Read the full diff. Check it against the spec, the repo's conventions, and the global code-quality
  rules.
- Re-run the verification suites yourself — a teammate's green report is necessary, not sufficient.
- Send amendments back to the teammate with SendMessage (specific: the problem, the fix shape, the
  files) and re-review until the workstream passes. Teammates stay addressable by name after they
  idle; message them rather than respawning.
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

- The plan gate is never skipped and never self-approved. No User, no go.
- Teammates never commit; the lead owns all version control.
- File ownership is exclusive within a wave; shared files force sequencing.
- The lead independently re-runs verification before accepting any workstream.
- All testing of running apps happens in scratch/e2e environments, never User's real files.
- Escalation to User is for scope decisions, not for work a review round can fix.
