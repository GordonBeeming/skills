---
name: work
description: >
  Plan, build, verify, and open a PR for a piece of work, with an autonomy dial that says which
  checkpoints wait for User. Explicit slash only: runs when User types `/work <source> [--mode ...]
  [--workers ...]`. Source is an issue URL, a PR URL for my own branch, a spec file, or plain words.
  Not for reviewing someone else's PR (use /review), not for read-only research or an explainer
  (plain plan mode), and never triggered by a bare URL.
gates: [plan, review, test, pr]
---

# /work

One fixed path: menu, profile, source, research, team, plan, build, verify, test, PR, report. The lead
(this session) writes specs, reviews every diff, runs the verification itself, and owns git. Teammates
build. Teammates never commit.

Each step names its input and output. Nothing between steps is optional prose. The only things that
stop and ask are the four gates named in the frontmatter, plus the issue question in step 2 when the
profile demands an issue.

## Caps

| Cap | Value | On hit |
|---|---|---|
| Teammates per wave | 5 | split into another wave |
| Fix rounds per workstream | 2 | mark the workstream `failed`, carry on with the rest |
| Asking a bot for a review | 1 per PR, ever | read and work every review it posts anyway; this limits the ask, never the work |
| Wait for one bot round | 30 min | treat the round as done; what came in is worked, the rest is the next round |
| Any single wait | 5 min | the `run-guard` hook denies `sleep` over 300 s; check now or record the step as blocked |
| Quiet | 45 min without a `run.json` update | the hook denies the next build command until the step status is written |
| Wall clock, build phase | chosen at step 0 (`2h`, `4h`, `8h`, or none), `4h` when unattended | the hook allows only git, gh, and read-only commands: commit, push, open the PR, mark remaining steps `skipped (cap)`, write the report. The clock stops once step 9 has a `startedAt`, and never counts time a gate spends waiting for User |

The last three are enforced by `scripts/run-guard.sh` (a PreToolUse hook), not by memory. The run
is found from cwd and `run.json.worktree`, so `run.json` must be real: `startedAt` is the actual UTC
time the run began (`date -u +%FT%TZ`), never a placeholder, and `endedAt` is set when the report is
written. `caps.wallClock` in `run.json` holds the answer (`"4h"`, `"90m"`, `"none"`). Waiting on User is
never build time: the moment a gate opens, write `caps.pausedAt` (epoch seconds) in `run.json`; the
moment he answers, clear it and add the wait to `caps.pausedSeconds`. The hook subtracts both, and
its stall rule is off while `pausedAt` is set. Editing `startedAt` to buy time is a defect; pause
and resume are the mechanism. Step 9 writes its `startedAt` the moment it begins, because that
is what stops the clock.

Delegate only for large, independent, parallel tracks. Work the lead can finish in a handful of tool
calls is not a workstream. If one teammate can own the whole track, use one.

## Flags

- `--mode auto` or `--mode <gate>[,<gate>]` where gate is `plan`, `review`, `test`, `pr`.
- `--workers <kind>[,<kind>]` where kind is `teams`, `agents`, `codex`, `agy`.
- `--closing auto|review|skip`. What happens to the closing comment on linked issues after the merge.
- `--evidence none|screenshots|video`. Screenshots or video means before and after captures of every affected screen or flow go into the PR.
- `--cap 2h|4h|8h|none`. The build-phase wall clock. `none` is no cap.
- `--design canvas|none`. Whether UI work starts with a `/design` canvas User refines before any code.
- Everything else on the command line is the source.

## Step 0: the menu

Input: the command line. Output: `mode`, `workers`, and `mode.chosenBy` for run.json.

Before any other tool call, one `AskUserQuestion` call carrying both questions. Drop a question when
its flag is already on the command.

1. "Which gates wait for you?" multi-select, exactly four options: `plan`, `review`, `test`, `pr`.
   Nothing ticked = `auto`.
2. "Which workers may I use?" multi-select, exactly four options: `agent teams` (in-process Claude
   teammates, named, SendMessage, shared tree), `Claude subagents` (one-shot Agent calls, worktree
   isolation available), `Codex agents` (codex-run), `Antigravity agents` (agy-run).

3. "Evidence?" single-select: `none`, `before + after screenshots`, `before + after demo video`
   (the change touches something a user sees). Skipped by `--evidence none|screenshots|video`. Pick
   screenshots for a static change, video when the behaviour is the point (a flow, an animation, a
   state change); the answer sets `mode.evidence` and is what makes step 3 capture the "before" state.
4. "Design it first?" single-select, asked whenever the work puts something new or changed in front
   of a user (a screen, page, view, component, layout, email or document template, a redesign of any
   of those): `design canvas first` (the lead writes the brief and User runs `/design` himself,
   then refines the artboards in the published artifact before any code), `straight to code`. Skipped by `--design canvas|none`.
   Default option is `design canvas first` for a new screen or a redesign, `straight to code` for a
   change inside an existing screen. A pure bug fix, an API, a script, or anything with no visible
   surface: not asked. The answer sets `mode.design`.
5. "Build-phase time cap?" single-select: `2h` (a focused change), `4h` (most work), `8h` (a big
   multi-workstream build), `unlimited` (no cap; the stall rule still applies). The recommendation
   is the first option, chosen from the source in one line: how many workstreams it looks like and
   whether anything is unknown. Skipped by `--cap 2h|4h|8h|none`. The answer is written to
   `run.json.caps.wallClock` (`unlimited` writes `"none"`), and it covers build time only: the
   clock stops at step 9 and never runs while a gate waits for User.

No user to answer (a routine, `claude -p`, a teammate session) and a flag missing: stop with one line,
`/work: pass --mode and --workers when nobody can answer the menu`. An unattended run whose `--mode`
names any gate stops the same way, because a gate with nobody behind it never opens. Nothing is
researched before this step resolves.

## Step 1: profile and run manifest

Input: cwd. Output: `<run dir>/run.json`, profile JSON in memory.

- Profile: `${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh` (add `--dir <repo>` when cwd is not the repo).
  Exit 2 means an unknown key in a profile file; stop and print its output. Schema and key meanings:
  `${CLAUDE_PLUGIN_ROOT}/skills/work/references/profile-schema.md`.
- Run dir: `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/runs/<yyyymmdd>-<slug>/`, slug from the source (issue
  number plus two or three words, or the branch name). Write `run.json` in the shape in
  `references/done-report.md` with every step `pending`, `mode`, `workers.pool`, `profile`, `source`.
- Worktree: `git rev-parse --show-toplevel` and the branch. If this is the main checkout sitting on the
  default branch, load `EnterWorktree` via ToolSearch and move into a fresh worktree first, so no commit
  can land on the default branch. Record the path in `run.json.worktree`.

Update `run.json` at every step boundary: `status`, `startedAt`, `endedAt`, `reason`.

## Step 2: source

Input: the source argument. Output: `<run dir>/source.md`.

- Issue or PR URL: `gh issue view <n> --repo <o>/<r> --json title,body,comments,labels,state,assignees`
  or `gh pr view` with comments. Fetch anything it links (`#123`, `fixes #456`, full URLs) as well.
- Claim the issue before any research, so nobody else picks it up while the plan is being written:
  no assignees, `gh issue edit <n> --repo <o>/<r> --add-assignee @me`; already User, nothing;
  assigned to someone else, one `AskUserQuestion` (take it over, or stop) and never a silent
  takeover. Record `claimed: <login>` in `source.md`. Same claim for an issue supplied through the
  `plan.requireIssue` question below.
- Words: quote the load-bearing phrases verbatim.
- Spec file: read all of it.

`plan.requireIssue` true and no issue in the source: one `AskUserQuestion` with two options: the issue
URL or number, or create one from the source. Create with
`gh issue create --repo <o>/<r> --title "<title>" --body-file <run dir>/issue.md --assignee @me`:
the assignee is on the create command itself, never a second step, so the issue is never open and
unowned. Body is the source (words or spec) written as User, in the repo's issue template if one
exists. Record the URL in `source.md` and `run.json.source`. This is the only question outside the
gates, and only when the profile demands it. Unattended: stop with one line naming the profile key.

## Step 3: research

Input: `source.md`, the repo. Output: `<run dir>/research.md`.

- Explore agents for breadth, direct reads for every file the work will touch. A plan built on unread
  code is worse than no plan.
- Read the repo's `CLAUDE.md` and `AGENTS.md`. Note the conventions and any ADR the work brushes up
  against.
- Test commands: `profile.test.command` when set, else what the repo's CI workflows and package
  scripts run.
- `mode.evidence` is screenshots or video: capture the **before** state now, while the code is still unchanged.
  Acquire the env lock if the app has to run (`envlock.sh acquire <env.lock> --wait 30m`), drive the
  affected screens with the driver in `profile.evidence.driver` (chrome extension, computer use, or
  headless Playwright) at each size in `profile.evidence.viewports`, save to
  `<run dir>/evidence/before-<screen>.png`; for video, record the flow with the `demo-video` skill's
  quick mode (drive the browser live, `screen-record.sh` records the window) and save `<run dir>/evidence/before-<flow>.mp4`; release the lock. If the screen can't be reached (needs
  data you don't have, a login you can't do, an environment you can't start), ask User with one
  `AskUserQuestion` for the before screenshots or the access, and record his answer; never skip the
  capture silently. This is the only step-3 question and only in screenshot mode.
- Source is a bug report: split it into observables (symptoms, ids, times, quoted logs) and inferences
  (the stated root cause, "confirmed via" sections, the task list). Verify the observables against
  code and telemetry, treat the inferences as hypotheses, and write the fault in one sentence: what
  stopped working, for whom, since when. If that sentence cannot be written, the plan's Approach is
  "gather these missing facts" and the build steps are skipped with that reason.

## Step 4: compose the team

Input: `research.md`, `workers.pool`. Output: the Team table and `run.json.workers.composition`.

- Draw only from the ticked pool. A kind not in the pool never appears in the table.
- One row per teammate: id, kind (`team`, `agent`, `codex`, `agy`), model, role (`build`, `review`,
  `test`), what they own. Sonnet is the default model for Claude rows. Any row above Sonnet carries
  `Justification:` naming what Sonnet could not do here despite the lead's spec and review. Antigravity
  rows default to `gemini-3.8-flash-low` for mechanical tracks and `gemini-3.1-pro-low` for review.
  Codex rows name the model explicitly; the runner refuses a run without one.
- `codex` and `agy` rows name the runner and mode: `codex-run --mode build` for a track,
  `codex-run --mode review` for an independent review pass. Review rows state the round cap.
- Exclusive file ownership within a wave. Two rows that need the same file go in different waves.
- Fewer, larger workstreams. Then a line on sequencing: what runs in parallel, what waits, and why.

## Step 5: plan

Input: everything above. Output: `<run dir>/plan.md`, and the `plan` step marked done.

Sections in this order, template in `${CLAUDE_PLUGIN_ROOT}/skills/work/references/plan-template.md`:
Team, Gates, Context, Approach, Workstream specs, Testing, Risks, Glossary. The Gates line is one
line naming the active gates so the reader sees what will stop.

A convention the work would break (naming, architecture, an ADR) is never folded in silently. With
the `plan` gate it is an open question in Risks for User to answer at the gate. Without the gate the
plan conforms to the convention and Risks says so.

- `plan` gate on: load `EnterPlanMode` via ToolSearch, write the plan, `ExitPlanMode`, wait. Approval
  is the go; no second confirmation. A rejection with notes means revise and present again.
- `plan` gate off: write the plan to the run dir, log its path in chat in one line, continue.
- `plan.postToIssue` true and the source is an issue: right after approval or logging,
  `gh issue comment <n> --body-file <run dir>/plan.md`. Record the comment URL in `outputs.plan`.

### `mode.design` is canvas

The plan's first workstream is the canvas, and User starts it, not the lead. `/design` takes the
brief as its arguments (`/design <brief>`) and is user-invocation only: the Skill tool refuses it
with "cannot be used with Skill tool due to disable-model-invocation", and that refusal also forbids
replicating the workflow by other means. So the lead:

1. Writes the brief to `<run dir>/design-brief.md`: which screens and states, what each one shows,
   the constraints it must respect (existing components, brand, data on the page), what is out of
   scope, and how many variants are worth seeing.
2. Puts the brief in chat, then one ready-to-paste line. `/design` runs inside this session and
   reads the conversation, so when the brief is already on screen the line is just `/design go`;
   spell the brief onto the command (`/design <one paragraph>`) only for a fresh or crowded session
   where the screens are not in view. Either way the brief is in chat first, so what it draws is
   what the plan says.
3. Waits. User runs it; Claude Design publishes a canvas of editable artboards and prints its
   link; User picks one, tweaks it, and says which artboard to build.
4. Builds from the chosen artboard. When the canvas was drawn in this session, its `.dc.html` files
   and `canvas.json` are on disk (the earlier a client project canvas left both in the run dir); read those. A
   canvas drawn elsewhere has no local copy, so read the published artifact from its link instead
   (`WebFetch` on the `claude.ai/code/artifact/...` URL) or ask User for the artboard's name and
   what he changed. Reopen an existing canvas with `/artifacts`; edits happen in the artifact and
   saving there publishes a new version.

Never hand-build an HTML "canvas" as a substitute: his canvas is editable, a hand-built page is not,
and the skill says not to. `/design` needs Claude Code 2.1.234 or later on a Pro, Max, Team, or
Enterprise plan; if it is unavailable, say so in one line and ask how he wants to proceed.

User refines it in the artifact; the code
workstreams start from the version he leaves there, and the plan is updated when what he leaves
differs from what was planned. Never build the UI first and draw the canvas afterwards.

## Step 6: build by wave

Input: `plan.md`. Output: teammate reports in `<run dir>/reports/<id>.md` or `.json`.

Write `<run dir>/shared-context.md` once and `<run dir>/spec-<id>.md` per workstream, templates in
`${CLAUDE_PLUGIN_ROOT}/skills/work/references/teammate-brief.md`. Then, per wave, in one message:

- `team`: Agent tool with `name: <id>` and `model` from the table, prompt pointing at both files.
  Later feedback goes through `SendMessage(to: <id>)`, never a second Agent call with the same name.
- `agent`: Agent tool one-shot with `model`. Add `isolation: "worktree"` when its files overlap another
  row in the same wave; the lead merges that worktree's diff back afterwards.
- `codex`: `${CLAUDE_PLUGIN_ROOT}/scripts/codex-run.sh --mode build --model <m> --repo <worktree>
  --prompt <run dir>/spec-<id>.md --out <run dir>/reports/<id>.json`.
- `agy`: `${CLAUDE_PLUGIN_ROOT}/scripts/agy-run.sh` with the same flags.

Completion is a file, not a message. Every teammate, whatever its kind, ends by writing
`<run dir>/reports/<id>.md` (team and agent rows write it themselves; the runners write the JSON).
A message that says "done" without the file is not done; a file without a message is done. The
lead never waits on a message.

Stall monitor, armed in the same message as the wave, `run_in_background`, and stopped when the
wave's report files are all present. It reports new report files, and it ends itself after 30
minutes so waiting has a hard stop:

```bash
prev=""; seen=""; n=0; while [ $n -lt 6 ]; do sleep 300; n=$((n+1))
  for f in <run dir>/reports/*; do case " $seen " in *" $f "*) ;; *) seen="$seen $f"; echo "REPORT $(basename "$f")";; esac; done
  cur=$( (git -C <worktree> diff; git -C <worktree> status --porcelain) | shasum | cut -c1-12)
  [ "$cur" = "$prev" ] && echo "STALL $(date -u +%H:%MZ) tree unchanged for 5m" || echo "OK $cur"
  prev=$cur; done; echo "MONITOR END: decide now, do not re-arm without acting"
```

On `REPORT <id>`: read the file and move on for that row. On the second consecutive `STALL`: the
lead checks, right then, with its own commands, never with another wait: `ls <run dir>/reports/`,
then `git -C <worktree> diff --stat -- <the row's files>`. Files changed and a report present means
done and unannounced (accept it). Files changed and no report means the teammate is finishing:
`SendMessage` once for the report, and if it is not on disk by the next check, mark the row
`failed (stalled)` and take the diff as is. Nothing changed means dead: mark `failed (stalled)`,
re-run that spec in the foreground (one-shot `Agent`) or do it yourself. `MONITOR END` with rows
still open is the same decision, made now. A third wait on the same row, in any form, is a defect.

Between waves that share files, the lead reviews (step 7 for those rows) and commits a checkpoint on
the worktree branch so the next wave starts from committed state.

## Step 7: lead verifies

Input: the diff and reports per workstream. Output: `run.json.workers.composition[].status`.

For every workstream, before accepting it:

1. Read the full diff (`git diff` on its owned files). Check it against the spec, the repo conventions,
   and the code-quality rules.
2. Re-run the verification commands from its spec yourself. A teammate's green is necessary, never
   sufficient.
3. Send feedback with the problem, the fix shape, and the files: `SendMessage` for `team`, a fresh
   Agent call carrying the spec plus the feedback for `agent`, `--resume <id>` on the runner for
   `codex` and `agy`. Two rounds, then `failed (2 fix rounds)` and move on.

Then integrate: every accepted workstream together, one run of the full test command.

`review` gate on: present the lead's review in chat, short, one paragraph per workstream with the
verdict and what changed in the fix rounds. An HTML artifact only when the diff is large enough that
chat cannot carry it. Then one `AskUserQuestion`: continue, or stop and report.

## Step 8: test

Input: the integrated worktree. Output: `<run dir>/test.md` with commands and observed output.

- `env.lock` set: `${CLAUDE_PLUGIN_ROOT}/scripts/envlock.sh acquire <env.lock> --wait 30m` before any
  launch. Exit 4 means another session holds it past the wait; mark the step `failed (lock held by
  <session>)`, no launch.
- Run `profile.test.command` (or the repo's commands from step 3), then the end-to-end checks the
  plan promised: drive the real flow, read the real output. `test.e2e` = `none` means no app launch;
  `scratch-only` means launch against scratch data only, never real user data.
- `test` gate on: hand over the running app or the exact commands and what each outcome means, then
  one `AskUserQuestion`: continue, or stop and report. The lock stays held through the gate.
- `mode.evidence` is screenshots or video: capture the **after** state of the same screens or flows,
  same sizes, same names under `<run dir>/evidence/after-<screen>.png` or `after-<flow>.mp4`, before
  the lock is released. Same fallback:
  ask User for them if you can't reach the screen.
- `envlock.sh release <env.lock>` when this step ends, whichever way it ends.

## Step 9: commit and PR

Input: the verified worktree. Output: `outputs.pr`.

Procedure in `${CLAUDE_PLUGIN_ROOT}/skills/work/references/pr-cycle.md`. The shape:

1. Plain git on the worktree branch (`profile.git.system` is always `git`). On the default branch,
   branch first as `gb/<category>/<slug>` (git-usage owns the categories). One commit per workstream where that keeps history readable.
   Never an AI or agent attribution line, whatever the profile says; `pr.coAuthorTrailer` only
   decides whether a human co-author User names gets a trailer. Signing per `git.signCommits`;
   never disable it to get a commit through. Git must never prompt: set up the headless key exactly as the
   git-usage skill's "Never prompt" section says before the first commit or push. Any prompt is an
   attack: stop, no retry, mark the step `failed (git prompted: <command>)`.
2. `pr` gate on: stop here, show the branch, the commits, and the drafted PR body, then one
   `AskUserQuestion`: create the PR, or stop and report.
3. `gh pr create --draft`, always. Ready only after the bot rounds are clean. Request each reviewer in
   `pr.botReview`.
   In screenshot or video mode, upload every `evidence/*` file with the `github-upload-file` skill
   and put a "Before / after" section in the PR body: one row per screen or flow, before on the
   left, after on the right (videos as links with a one-frame poster image), one line saying what
   changed. A row with only one of the two says why.
4. PR threads come first. From the moment the PR exists, an open bot or human thread is worked
   before any new verification loop, extra test, or browser run starts; a thread left open for an
   hour while the run does something else is a defect. One request per bot in `pr.botReview`, ever; any unprompted re-review is read and worked. Fixes go to the same teammate or runner that built the code.
5. Closing comment on every linked issue, asked now, before publishing, whatever `pr.autoMerge`
   says: one `AskUserQuestion` per PR (`auto` post on merge, `review` the draft in plan mode
   first, `skip`; plus close-on-merge yes/no; flag `--closing`, or the profile's
   `pr.closingComment` when it isn't `ask`). Write the drafts to `<run dir>/closing-<n>.md` per
   `references/closing-comment.md`. This question is allowed outside the gates because the
   wording lands on someone else's issue.
6. Publish (`gh pr ready`) once the rounds are clean. `pr.autoMerge` true: arm auto-merge or press
   the direct merge when the gate in pr-cycle.md holds, keep polling until it merges, then post the
   drafts. False: leave the merge to User; the drafts stay in the run dir and the
   `pr-closing-sweep` routine posts them when the PR merges. The report says which.

## Waiting is a check, never a state

A run is doing one of three things when a turn ends, and the third is a bug:

1. **Working.** Fine.
2. **Parked on User**: `caps.pausedAt` set, the step marked `blocked (waiting: <what>)`, one line
   saying what returns the turn. His next message resumes it. Fine.
3. **"Waiting" for something that is not a person**: a teammate, a suite, CI, a bot. This is the bug.
   Nothing wakes a session that has simply stopped, so the run sits idle until User notices, which
   has cost hours.

So there is no such thing as waiting for a machine. Either go and look now (read the log, the report
file in `<run dir>/reports/`, `gh pr checks`), or arm something that exits when the thing happens and
wakes the session: `run_in_background` on the command itself, a loop that ends when the report file
appears, a `Monitor` on the log, `scripts/pr-watch.sh` for a PR. Record each watcher's pid in
`run.json.watchers[]` and clear it when it is done. The `run-stop-guard` Stop hook refuses a turn
that ends with a step still running, nobody parked, and no watcher alive.

A teammate that has gone quiet is not a wait either: check its worktree diff and its report file,
and if both say it is finished, take the work over. If neither does, mark the row `failed (stalled)`
and do it yourself. Never say "I'll check on it later" and end the turn.

## A question User does not answer in time

The question tool gives him a minute. A minute passing means he was not at the screen, so it is not
a failure and it never ends the run. The run parks and waits for him to come back:

- Set `caps.pausedAt` in `run.json` and leave `endedAt` empty. The run is open, not over.
- Mark the step `blocked (waiting: <what you asked for>)`. `failed` is for something that went
  wrong; nothing has.
- Say it in one line, plainly: the question timed out, nothing is wrong, the run is holding here.
  Then list what is waiting, and end the turn with: say **ready** and I will ask again.
- Do not print the questions as prose for him to answer by hand, and do not answer them yourself.

When he says ready (or anything else that returns the turn), ask the same batch again with the same
`AskUserQuestion` call, clear `caps.pausedAt`, add the wait to `caps.pausedSeconds`, and carry on from
that step. Never re-run the earlier steps and never open a second run for the same work. A second
timeout parks it again, the same way, however many times it takes.

## Step 10: done report

Input: `run.json`. Output: the report, in chat.

Exact shape in `${CLAUDE_PLUGIN_ROOT}/skills/work/references/done-report.md`: three summary lines,
one line per step (`done`, `skipped (reason)`, `failed (reason)`), then outputs. Nothing else.
Set `endedAt` in `run.json` first.
