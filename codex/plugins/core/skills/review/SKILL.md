---
name: review
description: >
  Review code at a chosen depth, report the findings first, and post back only what User then chooses. Explicit slash only: runs when
  User types `$review [target] [--depth quick|standard|deep] [--post <levels>] [--event ...]`. Target
  is a PR URL or number, a branch name, nothing (the current branch against the default branch),
  `backlog`, or `dependabot`. Not for fixing review comments on my own PR (use $work), not for
  judging a screen or its UX, never merges anything, and never triggered by a bare URL or a pasted
  PR link.
---

# $review

One fixed path: menu, resolve, gather, review, verify, rank, artifact, write-back, fix plan, report.
The lead reads every hunk itself. At `deep`, five experts read as well and a verification pass
re-checks every finding against the code before anything is ranked. Nothing reaches GitHub unless
step 0 chose it. There are no gates after step 0: nothing else stops and asks.

Each step names its input and output.

## Caps

| Cap | Value | On hit |
|---|---|---|
| Panel experts | 5 | fixed roster in `references/panel.md`, never more |
| Verification passes | 1 | no second pass; unverified findings stay `unverified` |
| Concurrent reviewers (backlog) | 5 | queue the rest |
| Runner timeout (claude, agy) | 10m | mark that pass `failed (timeout)`, carry on |
| Wall clock | 1h | stop, mark remaining steps `skipped (cap)`, write the report |

Delegate only at `deep` (the panel) and for a backlog of five or more PRs. One PR at `quick` or
`standard` is the lead's own read. No subagent ever double-checks the lead.

## Flags

- `--depth quick|standard|deep`. What each does, exactly: `references/depth-matrix.md`.
- `--post <levels>`: post without asking, levels comma-separated (`blocker,high,medium`) or `none`.
- `--event approve|comment|request-changes`: the review event, without asking.
- `--blind`: read hunks only, explain the change, no verdict, no write-back.
- `--reviewer claude[:<model>]` or `--reviewer agy[:<model>]`: one extra independent pass through the
  runner. `standard` or `deep` only. Defaults: claude `sonnet`, agy `gemini-3.1-pro-low`.
- `--focus "<text>"`: a brief to validate against. Also taken from the words around the command.
- Anything else on the command line is the target.

## Step 0: the menu

Input: the command line, the profile. Output: `mode` for run.json.

Before any other tool call, one `request_user_input` (or `request_user_input_async`, whichever is listed) call with one single-select question, dropped
when `--depth` is already on the command:

1. "How deep?" options `quick`, `standard`, `deep`, each described by what it actually does, and a
   recommendation from the target: `quick` for a blocker check or more than one PR, `standard` for
   one PR that needs ranked findings and an artifact, `deep` for one risky PR. None of them re-runs
   the build or tests CI already runs.

Write-back is never decided here. Nothing reaches GitHub until the findings exist and User has
seen the summary (step 7). This question is required; it is not one of the "optional questions" a
default mode tells the model to skip in favour of assumptions.

Record `mode.chosenBy` as `question` or `flag` per answer.

Stop with one line, before any research, when:

- `--post` and the profile says `review.postComments: never`:
  `$review: profile <org> sets review.postComments=never; drop --post`. Same shape for `--event approve`
  against `review.approve: never`.
- `--post` or `--event` with `--blind`: `$review: blind mode never writes back`.
- `--depth deep` with `backlog`, `dependabot`, or `--blind`:
  `$review: deep is for one PR or branch; run it on the PRs this pass flags`.
- `--reviewer` with `--depth quick`: `$review: --reviewer needs standard or deep`.
- Nobody can answer (a routine, `codex exec`, or a teammate session) and a flag is missing:
  `$review: pass --depth and --post (levels or none) when nobody can answer the menu`. Unattended
  with `--post <levels>` and no `--event`, the recommendation in `references/post-review.md` is the
  event.
  A profile `always` never stands in for the flag.

## Step 1: resolve

Input: the target, cwd. Output: `<run dir>/run.json`, `<run dir>/profile.json`.

- Repo: `git rev-parse --show-toplevel`, then `gh repo view --json nameWithOwner`. A PR URL naming
  another repo: pass `-R <owner>/<repo>` on every `gh` call; there is no local checkout, so step 4
  ends `skipped (no local checkout)`.
- Target: `backlog` or `dependabot` as written; a URL, `#n`, or a number is a PR; a name is a branch
  and must pass `git rev-parse --verify <name>`; nothing is the current branch. On the default branch
  with no target: stop, `$review: on <default>; name a PR or branch`.
- Default branch: `git symbolic-ref refs/remotes/origin/HEAD --short`, else `origin/main`, else
  `origin/master`, else stop with one line.
- Profile: `${PLUGIN_ROOT}/scripts/profile.sh --dir <repo>` into `profile.json`. Exit 2 is an unknown
  key; stop and print its output. Keys read here: `review.postComments`, `review.approve`,
  `test.command`.
- Run dir: `${CODEX_HOME:-$HOME/.codex}/runs/<yyyymmdd>-review-<slug>/`, slug `pr-<n>`, the branch
  name, `backlog`, or `dependabot`. Write `run.json` in the shape in `references/depth-matrix.md`
  with every step `pending`. Update it at every step boundary.
- Print one scope line: target, base, file count, `+a/-d`, depth, write-back.

## Step 2: gather

Input: the resolved target. Output: `<run dir>/diff.patch`, `pr.json`, `threads.json`, `checks.txt`,
`context.md`; for `backlog` and `dependabot`, `triage.json`.

PR target:

```bash
gh pr view <n> --json number,title,author,url,baseRefName,headRefName,headRefOid,files,additions,deletions,isDraft,reviewDecision,mergeable,mergeStateStatus,labels,body > pr.json
gh pr diff <n> > diff.patch
gh pr checks <n> > checks.txt || true
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved isOutdated path line comments(first:20){nodes{author{login} body}}}}}}}' -F o=<owner> -F r=<repo> -F n=<n> > threads.json
```

`gh pr view --json reviews` does not carry thread resolution; only GraphQL does. `--blind`: only
`gh pr diff` (never `--patch`, it prepends commit messages) and `--json files,additions,deletions`.
No title, body, labels, threads, checks, or commit messages, and if any are already in context from
earlier in the session, say so in the report.

Branch target: `base=$(git merge-base HEAD <default>)`, then `git diff "$base"...HEAD` plus
`git diff HEAD` for uncommitted work, both into `diff.patch`.

`context.md`: what the change does in plain words (blind: from the hunks alone), the `AGENTS.md`
and `CLAUDE.md` paths at the root and in each touched directory, the files skipped as noise
(lockfiles, generated clients, vendored code, `dist/`, `bin/`, `obj/`) so the exclusion is visible,
and the test command (`test.command`, else what CI runs).

`backlog` and `dependabot`: `references/backlog-triage.md` builds `triage.json` and prints the
triage table before any PR is read.

## Step 3: review

Input: `diff.patch`, `context.md`. Output: `<run dir>/findings.json` (schema in
`references/depth-matrix.md`); `--blind` writes `reading.md` instead.

Coverage first, ranking later. Every finding goes in, including uncertain and low-severity ones, each
with a confidence and a severity guess. No reviewer, human or agent, is ever told to report only what
matters; step 5 ranks. Read the base-branch code around a hunk before calling it a bug.

- `quick` and `standard`: the lead reads every hunk and the code it touches, then writes every
  finding. `standard` also sets `needs_run` where only a build or test can settle it.
- `deep`: five `spawn_agent` calls in one message, model `gpt-5.6-sol`, one per seat in
  `references/panel.md`, each handed its brief, the absolute paths to `diff.patch` and `context.md`,
  the schema, and the coverage instruction verbatim. Output `panel/<seat>.json`. Then confirm every
  seat returned an array: an idle agent with nothing delivered is a silent gap, so re-request once,
  and if it still does not arrive the lead reviews that angle itself and writes the file with
  `"coveredBy": "lead"`. The report names which seats reported.
- `--reviewer`: write `runner/<name>.prompt.md` (generalist brief from `references/panel.md`), then
  `${PLUGIN_ROOT}/scripts/claude-run.sh --mode review --model <m> --repo <repo> --prompt <that file>
  --out runner/<name>.json --timeout 10m` (or `agy-run.sh`). Extract the findings array from the
  report's response.
- `backlog`: batches from `triage.json`, one pass per PR at the chosen depth. Under five PRs the lead
  reads them in sequence; five or more, one `spawn_agent` per PR, model `gpt-5.6-sol`, five at a time.
- `dependabot`: classify per `references/backlog-triage.md`; the concerns are the findings.
- `--blind`: read every hunk, fill context gaps from unchanged code, then sort into the taxonomy in
  `references/depth-matrix.md`. Every count is `grep -c` over `diff.patch`, never an estimate.

Every reviewer that is not the lead is read-only and runs no git network command (`fetch`, `pull`,
`checkout`, `gh pr checkout`). Git never prompts on this machine and a prompt is treated as an attack
(git-usage skill, "Never prompt"). `gh pr diff` and the working copy on disk are enough.

Merge everything into `findings.json` with `expert` set per source.

## Step 4: verify

Input: `findings.json`. Output: `findings.json` with a `status` per finding, `verification.log`.

- `quick`: `skipped (depth quick)`.
- `standard`: CI is the build and test run; never repeat it. Read what CI already settled:
  `gh pr checks <n>` and, for anything failing, `gh run view <run-id> --log-failed`. A finding CI
  settles (it fails the build, it breaks a test CI runs, the test CI runs proves it wrong) is marked
  from CI with the check name. Only a `needs_run` finding CI cannot answer gets a local run, and that
  run is the narrowest thing that settles it: one test written or filtered for that case, one
  command, never the suite and never a full build. With a local checkout: `git fetch origin
  <headRefName>` (headless per the git-usage skill's "Never prompt" section; a prompt is an attack,
  stop and report), `git worktree add --detach <run dir>/wt <headRefOid>`, run there, `git worktree
  remove <run dir>/wt` when the step ends. CI still running: say so and verify from the diff, never
  run the suite to get ahead of it. Never launch the app; a finding only a running app can settle is
  marked `unverified` and lands in open questions. Log each command and its real result.
- `deep`: one pass over every finding, panel and runner alike. Dedup on file, nearby line, and
  normalised title, keeping the highest severity and every contributing seat. Score 0 to 100 with the
  rubric in `references/depth-matrix.md`; the score overwrites the finder's confidence. A finding
  drawn from a rule file: open the file and quote the rule, drop it if the rule does not say that.
  Drop findings on lines the change did not touch unless the change makes them reachable, and say
  why. `needs_run` findings get the same targeted validation as `standard`. Status: `confirmed` at
  80 or above, else `filtered`; a verified non-issue is `false-positive`. Nothing is deleted:
  `filtered` and `false-positive` stay in the file and in the artifact appendix.

## Step 5: rank

Input: `findings.json`. Output: `findings.json` with `verdict` and findings ordered by severity.

Severity, one home for the whole skill:

- **Blocker**: likely user-facing breakage, security hole, data loss, or a direct failure of the brief.
- **High**: plausible production bug, or a required validation that is missing.
- **Medium**: real maintainability, observability, race, or edge-case risk.
- **Low**: polish, naming, test gaps, questions.

Borderline between two: the higher one. Verdict is `approve` when no Blocker and no High remain (at
`deep`, among `confirmed`), else `hold`. With `--focus`, add `meets`, `partial`, or `fails` against
the brief. Backlog with `--approve` uses the sweep bar in `references/backlog-triage.md`: no Medium
either. `--blind` has no verdict.

In chat: `quick` prints the verdict and Blockers only; `standard` and `deep` print the verdict,
counts per severity, and the top findings with `file:line`.

## Step 6: artifact

Input: `findings.json` or `reading.md`. Output: `outputs.artifact` in run.json.

`standard` and `deep` (and `--blind` at `standard`) build one HTML file per
`references/artifact.md` at `/Users/user/Developer/artifacts/<repo>/review-<pr-or-branch>-<yyyymmdd>.html`.
Brand from the `brand-guidelines` skill (personal unless the repo's org routes elsewhere). Run the
global visual QA loop before handing back the `file://` link. `quick`: `skipped (depth quick)`.

## Step 7: post the review, if User says so

Input: `findings.json`, the chat summary. Output: `<run dir>/writeback.log`.

Nothing has been posted before this step, whatever the profile says. In order:

1. The summary in chat: the verdict, the counts per level, and every finding in one line each
   (level, file and line, what is wrong). This is what User decides from.
2. The three questions in `references/post-review.md`: post at all, which levels, which event with
   the run's recommendation. Each is skipped by its flag. `no` ends the step: `skipped (not chosen)`.
3. Build `<run dir>/review-comments.json` (one entry per posted finding, anchored to a line the diff
   touches) and `<run dir>/review-body.md`, then post ONE review with the chosen event, exactly as
   `references/post-review.md` sets out. Every comment lands inside that review; never a loose
   comment, never one review per finding.
4. Record every URL in `writeback.log` and `run.json.outputs.review`.

Branch target with no PR: `skipped (no PR)`. `backlog` and `dependabot`: per PR, per the write-back
rules in `references/backlog-triage.md`, still asked once for the whole sweep rather than per PR.

Never merge, never dismiss another reviewer's review, never approve over an unresolved thread.

## Step 8: fix plan

Input: `findings.json`. Output: `<run dir>/fix-plan.md`.

`deep` only; other depths `skipped (depth <x>)`. One item per `confirmed` finding at Medium or above:
finding id, file, the intended edit in one or two lines. First line of the file:
`$work <run dir>/fix-plan.md --mode plan`. Do not run `$work`, do not edit code.

## Step 9: report

Input: `run.json`. Output: the report, in chat. Set `endedAt` first.

Three summary lines, then one line per step, then outputs.

```text
$review <target> at <depth>: <verdict>. <the biggest finding in one line, or "no Blocker or High">.
Posted: <nothing (not chosen) | <event> with n inline comments <url> | skipped (no PR)>.
Reviewers: <lead | lead + seats that reported | lead + claude>.
Steps: 0 menu done · 1 resolve done · 2 gather done · 3 review done · 4 verify skipped (depth quick) · ...
Outputs: artifact file:///... · fix plan <path> · run.json <path>
```

## Boundaries

- Never edit the target code, never commit, never push, never merge, never retarget or rebuild a PR.
- Posts exactly what step 0 chose, once, and nothing on a `hold`.
- Deliver the review asked for. No refactor proposals, no follow-up tickets; at `deep` the fix plan
  is the only forward-looking output.
- A finding is never dropped silently. Filtered and false-positive findings stay visible.
- A cap hit is reported as a stop with its reason, never worked around.
