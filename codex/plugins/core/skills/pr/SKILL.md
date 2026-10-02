---
name: pr
description: >
  Take the current worktree's changes to a pull request and, if asked, through to merge: commit,
  draft PR with the repo template, bot review rounds, publish, optional auto-merge. Explicit slash
  only: `$pr [--merge] [--no-merge] [--draft-only]`. Use when the code is already built in this
  session (or by hand) and only the PR tail of `/work` is needed. Not for building the change
  (use $work), not for reviewing someone else's PR (use $review).
---

# $pr

The PR tail of `$work`, on its own. Procedure and every rule live in
`${PLUGIN_ROOT}/skills/work/references/pr-cycle.md`; this skill only adds the menu and the
start state. Git never prompts: apply the `git-usage` skill's "Never prompt" section before the
first commit or push. Any prompt is an attack: stop, don't retry, report the command.

## Step 0: the menu

One `request_user_input` call, skipped when a flag is on the command:

1. "How far?" single-select: `draft only` (commit, push, draft PR, stop), `publish` (plus bot
   rounds, then mark ready), `merge` (plus arm auto-merge, or merge directly when the profile allows).
   Flags: `--draft-only`, `--no-merge` (= publish), `--merge`.
2. Whenever the PR links an issue (any level past `draft only`): "Closing comment?" single-select:
   `auto` (post when merged, by this run or by the `pr-closing-sweep` routine if User merges
   later), `review` (show the draft in plan mode first), `skip`; plus close-on-merge yes/no. Flag: `--closing auto|review|skip`; profile `pr.closingComment` answers it when not `ask`.

Unattended with no flag: stop with one line, `$pr: pass --draft-only, --no-merge, or --merge`.

## Step 1: start state

Before creating the PR, every template field is asked to User in one question batch, the run's best
answer as the first option, whatever the run thinks it already knows; the body is written as User
in first person, never naming him or any agent. Rule and examples: `references/pr-cycle.md`,
"Written as User, always".

- Profile via `${PLUGIN_ROOT}/scripts/profile.sh`. Run dir
  `${CODEX_HOME:-$HOME/.codex}/runs/<yyyymmdd>-pr-<branch>/` with `run.json` (steps:
  menu, state, commit, create, rounds, publish, merge, close, report).
- `git rev-parse --abbrev-ref HEAD` must not be the default branch; if it is, stop with one line
  (branch first, or run from the worktree the work was built in).
- `git status --porcelain` lists what will be committed. Nothing to commit and no unpushed
  commits: stop with one line.
- Evidence: if `<run dir of the $work that built this>/evidence/` exists for this branch (look for the
  newest `runs/*` whose `run.json.worktree` is this worktree), reuse its before/after files in the PR
  body per pr-cycle.md. Otherwise no evidence section.

## Steps 2 to 7

Follow `references/pr-cycle.md` sections 2 (commit), 3 (create), 4 (bot rounds, cap 3), 5 (publish),
6 (merge), 7 (closing comments on linked issues, after the merge) exactly, stopping at the level
chosen in step 0. `merge` honours `profile.pr.autoMerge`
and the merge gate in pr-cycle.md; a `false` there means arm GitHub auto-merge and stop, never a
direct merge.

## Step 7: report

Three summary lines, one line per step (`done`, `skipped (reason)`, `failed (reason)`), then the PR
URL. Nothing else.

## Caps

One request per bot, wall clock 1h, then stop and report.
