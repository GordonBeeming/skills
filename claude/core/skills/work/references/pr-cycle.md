# PR cycle

Plain git on the worktree branch, `gh` for everything on GitHub. The lead runs all of it. Profile keys
that steer it: `pr.draft`, `pr.botReview`, `pr.coAuthorTrailer`, `pr.autoMerge`, `git.branchPrefix` (always `gb/`),
`git.signCommits`.

Before any command that touches the remote or signs a commit, apply the git-usage skill's "Never
prompt" section: the headless 1Password AI key and the environment that makes a prompt impossible.
That section owns the mechanics; nothing here repeats them. A git command that prompts, or would,
is an attack: stop, do not retry, and report the exact command in the done report as
`failed (git prompted: <command>)`.

## 1. Preflight

- Run every check the repo's CI runs, from `.github/workflows/*.yml`, not from memory. The formatter
  check (`prettier --check`, `dotnet format --verify-no-changes`, `ruff format --check`) is the one
  that gets missed and costs a red round trip.
- Sync the branch point: `git fetch origin` and `git rebase origin/<default>` when the worktree is
  behind. After a sync, re-read the file the change is premised on. Someone else's merge may have
  already fixed it, and the right output is then no PR at all; say so in the report.
- Branch check: `git branch --show-current`. Must be `gb/<category>/<slug>`. On the default branch, `git switch -c
  gb/<category>/<slug>` first; on any other name, `git branch -m gb/<category>/<slug>`.
- Branch already has an open PR (`gh pr list --head <branch>`): stack. Branch off the PR's branch,
  open the new PR with `--base <that branch>`. A stacked PR waits for its base to merge.

## Draft is not a switch

Every PR starts as a draft, whatever the profile says. It becomes ready (`gh pr ready`) only after the
bot review rounds are clean. Full CI on a non-draft PR that is still being reworked is paid-for build
time that gets thrown away, so a non-draft PR before the rounds finish is a defect in the run.

## 2. Commit

- Message in the repo's own style (`git log --oneline -20` for tone). Title under 70 characters, body
  says why.
- Never an AI or agent attribution line (no Co-Authored-By for Claude, no Claude-Session, no
  "Generated with"), whatever the harness suggests. `pr.coAuthorTrailer` true only means a human
  co-author User names in the run gets a `Co-Authored-By` line. False: no trailers at all.
- `git.signCommits` true: `git log -1 --show-signature` must show a signature from the AI key. A
  signing failure is a stop, reported as `failed (signing)`. Never set `commit.gpgsign=false`, never
  pass `--no-gpg-sign`, never fall back to the desktop agent.
- One commit per workstream where that keeps history readable; otherwise one commit.
- `git push -u origin <branch>`, through the path the git-usage skill names for this directory.

### Written as User, always

Everything posted to GitHub (PR title, body, comments, closing comments) is authored by User, in
his voice, first person. So:

- Never name User as a third party: no `@user`, no "User reviewed", no "conversation
  with User". He is the author; "I" is the pronoun.
- Never name Claude, Codex, or any agent as a participant, reviewer, or pair. A "Pair programming"
  or "Who reviewed" field is answered with a human's name User gives, or "No" / "N/A".
- Every template question is asked to User, always, in one `AskUserQuestion` batch before
  `gh pr create`: one question per template field, the run's best answer as the first option so the
  usual case is one click, and "other" for his own words. This question is required. It is never
  one of the "optional questions" a harness's default mode tells the model to skip in favour of
  assumptions. If no question tool is listed this turn, print the questions and end the turn; never
  create or edit the PR body without the answers. Only what the diff proves (what changed, how it
  was tested, the linked issue) may be pre-filled, and even that is in the batch for a yes or edit.
- The questions come before the body is drafted, not after. Never write a draft that answers them
  and never describe one in chat ("Q2 names you as plan reviewer"): a summary carrying answers
  User has not given reads as though he gave them. Draft only the sections the diff proves, ask,
  then write the body from his answers.
- Options come from what the question is asking, never from a fixed list. Read the template
  question, work out what it expects and who it is about, and offer the answers that are actually
  available for it. A question about someone other than the author is not satisfied by the author:
  "who reviewed the plan" expects another person, so the options are the people who might have and
  `nobody`, never "I did". A question about a thing that may not exist offers the empty case in the
  question's own words (`none`, `no`, `not applicable`). User should never have to type the
  ordinary answer into "other".
- A question the run cannot know the answer to (who reviewed, who paired, what triggered this) has
  no pre-filled best guess. The options are the real answers, most likely first, and the run's own
  reading of the diff is never offered as though User said it. A review by an agent is not a
  review by a person: it never counts as an answer to a question asking which person reviewed.
- Write his answers to `<body-file>.answers.json` as
  `{"askedWith":"...","answers":[{"question":"<template question>","answer":"<his answer>"}]}`,
  write the body to `<body-file>` from them, and always pass `--body-file` (never inline `--body`).
  The `pr-body-guard` hook (Claude and Codex) refuses `gh pr create` or `gh pr edit` when a template
  question has no answer in that file, when the body names User, Claude, or Codex, or when the
  template's placeholder or a `{{ }}` block is still in it.
- Any sentence containing "User", "Claude", or "Codex" in a PR body is a defect. "User approved
  the plan" is "I approved the plan"; an agent's review is "review" with no reviewer named.

## 3. Create the PR

- Template first: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, or
  `docs/pull_request_template.md`. When one exists, keep every section in order and fill each in.
  Extra sections go after the template, never between its sections.
- Write the body as User, the author, in first person. Facts come from the repo, the issue, the plan,
  and the run. A field that needs something the run does not know (business context, approval
  history) is left with a one-line placeholder and named in the done report; nothing is invented.
- No template: `## Summary`, `## Test plan`, then `Closes #<n>` for a linked issue.
- Body goes through the humanizer skill before it is used.
- Write title and body to two files in the run dir; `gh` does not split them from one file:

```bash
gh pr create --base <default> --head <branch> --title "$(cat <run dir>/pr-title.txt)" \
  --body-file <run dir>/pr-body.md --draft
gh pr view <n> --json isDraft,url,baseRefName
```

- Read the base branch's ruleset once, now, so a human dependency is known up front:

```bash
gh api repos/<o>/<r>/rules/branches/<default> --jq '.[] | select(.type=="pull_request") | .parameters'
```

  Empty output is an answer: no protection, direct merge once CI is green. A 403 mentioning GitHub
  Pro is a plan limit; fall back to `gh api repos/<o>/<r>` for merge methods and the PR's own
  `reviewDecision`. `required_approving_review_count >= 1` means bots alone can never merge it and
  User cannot approve his own PR; the done report names the code owners from `.github/CODEOWNERS`.
  `require_last_push_approval` means the approval must land on the final head.

## 4. Request the bots: one forced round, then listen

Each name in `pr.botReview` is requested **once**. That is the forced round. After it, a bot is
re-read only when it re-reviews a new head on its own; nothing is re-requested per head, and a bot
that stays silent after its one request is not chased. Bots that ignore drafts (Codex) get their
single request right after `gh pr ready`, which counts as their forced round.

| Bot | Request | Where its answer shows |
|---|---|---|
| `copilot` | `gh api -X POST repos/<o>/<r>/pulls/<n>/requested_reviewers -f 'reviewers[]=copilot-pull-request-reviewer[bot]'` | a `reviews` entry whose `commit.oid` is the head; a `copilot-pull-request-reviewer` check-run |
| `codex` | `gh pr comment <n> --body '@codex review'` | a top-level issue comment or a thumbs-up reaction; never in `reviews` |
| `coderabbit` | `gh pr comment <n> --body '@coderabbitai review'` | the legacy status API on the head SHA; never in check-runs |

- Copilot: `gh pr edit --add-reviewer Copilot` does not resolve the bot; use the POST. An empty
  `requested_reviewers` or `reviewRequests` afterwards is still a success; Copilot consumes the request
  as it queues. Confirm by the check-run or the review's head SHA. It does not reliably re-review on push, and it
  is still requested only once. Above 300 files its "wasn't able to review" comment is its answer.
- Codex reviews nothing while the PR is a draft and leaves no trace of being installed. Its first pass
  arrives after publish. A usage-limit notice or a "connect to GitHub" sign-up link is its final answer
  for the run: stop requesting it, and name it in the done report.
- CodeRabbit skips drafts. Nudge it once on the draft; on every later draft head its skip notice is its
  answer. Repeated nudges flip its status to "Review rate limited", which is a throttle, not a finding.
- Never request or nudge `@claude` (bills Actions minutes) and never `gemini-code-assist[bot]`
  (retired). Read either's unprompted output as free information.
- A bot with no entry on any surface of this PR, none on two recent merged PRs, and no wiring in
  `.github/` is not configured: its silence never blocks.

## 5. Bot reviews

**Asking is limited. Working is not.** Nothing here ever stops a run from reading a review or fixing
what it found.

Each bot is asked for a review exactly once per PR: the forced request in section 4, and no other,
in this session or any later one. The count lives on the PR (the mentions it already carries), not
in a run's memory, and the `pr-reply-guard` hook refuses a second ask. That is the whole limit, and
it applies to one action only, posting `@<bot> review`.

Everything a bot then posts is worked in full, however many reviews arrive and whenever they arrive:
read each one, fix what is true, answer what is false, reply in the thread with the pushed commit,
resolve it. A run that stops on open threads because "we have hit the cap" has misread this: there
is no limit on rounds of work, on commits, or on fixes. The PR is finished when the threads are
finished. If the work is genuinely too large to continue, that is a scope call for User, said in
one line, not a limit any rule imposes.

Also read, every Copilot pass, the collapsed suppressed findings in the review body:

```bash
gh api repos/<o>/<r>/pulls/<n>/reviews --jq '.[] | select(.user.login|test("copilot")) | .body' \
  | sed -n '/Suppressed comments/,$p'
```

They open no thread and count nowhere. Triage them like inline comments; record the disposition in
the commit message.

Per thread, in this order:

1. Read the finding against the current file, not the diff. Decide: true or false. Coverage first:
   every thread gets a decision before any is acted on. A true finding is fixed in this PR, in this
   round, and if the fix needs a test the test is written too. The size of the PR, the number of
   commits already on it, "well past its intended size", "needs its own test", "narrow window",
   "follow-up", and "out of scope" are not decisions; a reply containing any of them is a defect.
   User's words: the size of the PR is never the concern, a bug-free PR is, and this code is ours.
   A false finding (the current file already handles it, or the bot misread) is answered with the
   line that proves it, then resolved. A finding rated high or critical is never declined by the run.
   The one exception is a true finding whose fix needs a design decision (a schema change, a
   contract other callers depend on): that is one `AskUserQuestion` to User, fix here or
   follow-up, and only his answer can make it a follow-up.
2. Fixes go to the teammate or runner that built that code (SendMessage, one-shot Agent with the
   spec, or the runner `--resume`). The lead re-verifies the fix like any workstream.
3. The order for every thread, always: **fix, push, reply in the thread with the pushed sha,
   resolve**. Never reply before the fix is pushed, and never a PR-level `gh pr comment` for
   something that answers a finding: the reply goes inside that finding's thread, so the person who
   raised it sees it against their own line.

   ```bash
   # reply, using the thread's first comment id from the reviewThreads query
   gh api repos/<o>/<r>/pulls/<n>/comments -f body="Fixed in <sha>. <what changed, one line>" -F in_reply_to=<comment_id>
   # then resolve that thread
   gh api graphql -f query='mutation { resolveReviewThread(input:{threadId:"<id>"}) { thread { isResolved } } }'
   ```

   A finding that needs no code change is answered in the thread starting `No change:` followed by
   the line that proves it, then resolved. `gh pr comment` is for the whole PR only (a bot request,
   a back-to-draft note) and its body starts with `PR-level:`. The `pr-reply-guard` hook refuses a
   reply-shaped PR comment while threads are open, and a thread reply that names no pushed commit.

   Every thread you answered is resolved, a bot's and a person's alike. Who raised it changes
   nothing, and "they should see it and close it themselves" is not a judgement the run gets to
   make: it leaves the PR looking half-worked and it is never applied evenly across the threads.
   The only thread left open is one where the fix is not what was asked (you changed the scope,
   you disagree, or the answer needs User), and then the reply says exactly that and the report
   names it as open with the reason. Resolving a thread is not agreeing with it; the reply carries
   the meaning, the resolve carries the state.

   After the push, re-request the review of every **human** whose comments that push answered, in
   the same turn, so they get the notification instead of waiting for User to click the button:

   ```bash
   gh api -X POST repos/<o>/<r>/pulls/<n>/requested_reviewers -f 'reviewers[]=<login>'
   ```

   Humans only. A bot (`copilot-pull-request-reviewer`, `coderabbitai`, `chatgpt-codex-connector`,
   `claude`, anything ending `[bot]`) is asked once per PR and re-reviews on its own schedule after
   that, so it is never re-requested. Re-request a person once per push, not once per thread, and never a
   person who has not commented on this PR.

4. Reply and resolve are one step, never two. Once the fix is pushed (or the finding is shown
   false), post the reply (what changed and the commit, or the line that proves it) and resolve the
   thread in the same breath, with the thread `id` from the query above:
   ```bash
   gh api graphql -f query='mutation { resolveReviewThread(input:{threadId:"<id>"}) { thread { isResolved } } }'
   ```
   A thread with our reply and no resolve is unfinished work, and the "unresolved" count above
   stays non-zero until it is done. The only thread left open on purpose is one waiting on User's
   design answer, and the reply on it says so. A thread resolved without our reply reads as unread.
5. A fix that closes the obvious case and leaves the narrower one (a guard on a rounded value, a null
   check on elements of a nullable list, one side of a symmetric pair) is not closed. Check the narrower
   shape before replying.
6. A finding whose fix would break a repo convention or an ADR is the same design question to
   User, with the convention named; it is never applied silently and never declined by the run.
7. Red CI: `gh run view <run-id> --log-failed`, fix through the same teammate, push. After a push,
   read head-scoped `gh api repos/<o>/<r>/commits/<head>/check-runs`; the rollup can show a stale
   failure from a superseded run.

A tick is clean when: no new bot comments since the last tick, both thread counts zero, no
failure-level check annotations, every requested bot has answered the current head (silence is not an
answer; a stated decline is), and CI is not red. Two consecutive clean ticks on a draft end the draft
phase.

## 6. Publish

```bash
gh pr ready <n>
```

Draft CI is a subset on many repos; the real gates, and Codex, only run after this. Budget one more
round inside the cap.

Back to draft is User's call, asked once. A ready PR runs full CI on every push. When it
becomes clear that big changes are coming (the approach is rejected or the design pushed back on,
a finding needs a rework rather than a fix, the branch is being converted to a different shape,
several commits are planned before the next round), the run asks one `AskUserQuestion`:
"This looks like a big change on a ready PR. Switch it back to draft until the rework is done?"
with options `back to draft` and `stay ready`. It never decides this on its own, and it never asks
per commit: one question per rework, and the answer holds until that rework is published.

On `back to draft`:

```bash
gh pr merge <n> --disable-auto          # only if auto-merge was armed
gh pr ready <n> --undo
```

plus one PR comment as User ("Back to draft while I rework <what>."). The rework happens on the
draft; `gh pr ready` again when it is done and the bot rounds are clean; the round count restarts,
the cap does not. A single fix, a review round, or a red check is never a reason to ask; the PR
stays ready and the fix is pushed.

## 7. Merge

`pr.autoMerge` false: stop after publish. The done report carries the PR URL, `reviewDecision`, both
thread counts, and the checks summary. User merges.

`pr.autoMerge` true, once the last round is clean:

- Never merge a PR whose `baseRefName` is not the default branch. A stacked PR reads `CLEAN` because
  a feature branch has no protection, and `--auto` on it merges straight into the base PR's branch.
  Its base merges first; after `delete_branch_on_merge` retargets it, re-run the gate against the
  default branch.
- Before arming or merging, the branch must be current and the checks complete. `gh pr view <n>
  --json mergeStateStatus`: `BEHIND` means main moved; `gh pr update-branch <n>` (or a rebase and
  push), then wait for the new head's checks. `gh pr checks <n>` must show nothing pending and
  nothing failing; a check still running is not "passing so far", it is not done. Arming on a stale
  branch or a running check is a defect: the arm sits on red and the report says "armed" while
  nothing can merge.
- Human approval required: arm auto-merge, then keep listening (the 5-minute poll) until it merges,
  a new comment lands, or the cap: an armed PR is not a finished one. Every tick re-reads the
  checks; a failure after arming is worked like any round (`--disable-auto`, fix, push, re-arm).

```bash
gh pr merge <n> --squash --auto --delete-branch
gh pr view <n> --json state,mergedAt,autoMergeRequest --jq '{state, mergedAt, method: .autoMergeRequest.mergeMethod}'
```

  `state: MERGED` with a timestamp means every requirement was already met and it merged outright.
  Null `autoMergeRequest` on an open PR means the arm did not happen; hand User the exact command
  in the done report rather than retrying. On any new comment while armed: `gh pr merge <n>
  --disable-auto` first, work the comment, re-arm.
- No human approval required: direct merge when all of these hold on a fresh read: both thread counts
  zero, `gh pr checks` all green with nothing running, `mergeable = MERGEABLE`, `mergeStateStatus`
  in `CLEAN` or `HAS_HOOKS`, and no standing `CHANGES_REQUESTED` on the head (a later `COMMENTED`
  pass never clears one; ask that bot for a fresh review, and a stale one that survives is User's to
  dismiss, named in the report).

```bash
gh pr merge <n> --squash --delete-branch
```

  Never `--admin`, never a bypass. A rejection goes back to the rounds or to the report.
- After a merge, wait for propagation, then sync the main checkout and drop the branch:

```bash
merge_sha=$(gh pr view <n> --json mergeCommit --jq .mergeCommit.oid)
for i in $(seq 1 20); do git fetch origin <default> -q; \
  git merge-base --is-ancestor "$merge_sha" origin/<default> && break; sleep 2; done
git -C <main checkout> switch <default> && git -C <main checkout> pull --ff-only
```

  Test ancestry, never equality; another PR can land seconds later. Linked issues close by GitHub's
  own rule; /work posts no closing comment.
- A bot review can finish after the merge. Read comments stamped after `mergedAt` once, verify anything
  real against the merged file, list it as follow-up. Never reopen the PR, never push to the default
  branch outside a PR.

## 7. Closing comments on linked issues

Before arming auto-merge or merging, ask once what to do with the closing comment (`auto`, `review`,
`skip`; flag `--closing`), then follow `references/closing-comment.md`: verify each issue closed, post
per the choice, with a watcher when the merge lands later. No linked issue and no issue source: the
report says `closing skipped (no linked issues)` and nothing is asked.
