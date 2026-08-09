# Reference: merge (lead only)

On the teammate's merge-ready report, re-verify independently before acting — trust but verify, the
evidence may be a tick stale.

## Review-audit gate — standard / non-personal tier: mandatory BEFORE merge

On a non-personal repo the human-eye gate is the required code-owner approval on GitHub, and the audit
gives that reviewer the full disposition picture before the change lands — mandatory to produce and
deliver, not optional, and it holds even when every check is green.

Build the audit from the resolve log accumulated over the cycle (log each comment's disposition as you
go, so this is assembly, not reconstruction): a self-contained HTML doc following User's artifact
conventions with, per review comment:

- the `file:line` and a summarized code hunk
- the comment
- the disposition (**fixed / declined / refuted / reverted**)
- a **driver** tag (`real` genuine bug/security/correctness · `hygiene` test-fidelity/doc-accuracy ·
  `bot-nit` marginal, complied only because a bot asked · `no-change` declined/refuted)
- a **per-comment deep link to the exact GitHub review comment** (its `html_url` from
  `gh api repos/<o>/<r>/pulls/<n>/comments`, so User clicks straight to the inline code + thread) plus
  the commit link — **every link `target="_blank" rel="noopener"`** so it opens in a new tab and doesn't
  lose the audit

Summarize to digest fast, with an up-front callout listing the changes made mainly because a bot asked so
User can veto/revert any. `SendUserFile` it.

When a human code-owner approval is still required (the usual case on protected main), that approval is
the gate — **arm auto-merge automatically the moment the waiting state is reached** (see below), rather
than sitting on a separate pre-merge sign-off. Only on the direct-merge path — no human reviewer required,
so the lead presses merge itself — does the manual press wait on User's explicit go on the audit (he may
first ask to drop bot-nit changes — treat those like any fix round).

**Personal tier: no pre-merge gate** — merge, then deliver the audit afterwards (informational). The
audit is always produced either way; only its timing relative to the merge differs by tier. This is
deliberate friction against the skill being too impressionable — the audit surfaces every bot-driven
change for a human eye before it lands on a shared repo.

**Zero-finding runs report inline instead of shipping an empty document.** When every bot's review came
back with no inline comments, the audit has no rows: no dispositions, no drivers, no bot-driven changes
to veto. An HTML file whose only content is "nothing was flagged" is the artifact anti-pattern — it
restates the run back at User and carries no fact he doesn't have. State it in the summary instead
(which bots reviewed, which head, zero comments each) and skip the file. Produce the document the moment
there is at least one review comment to tabulate.

## Pre-armed auto-merge — the audit moves to the front

A PR can arrive at this skill with auto-merge already armed by whoever opened it. That inverts the
normal ordering, because the first thing the loop does, resolving review threads, is usually the last
protection standing between the PR and an automatic merge. Clear the threads and GitHub merges within
seconds, with no window left to deliver a pre-merge audit in.

So when `autoMergeRequest` is non-null at routing time:

- **Produce and deliver the standard-tier audit before the resolve round lands**, not after the
  merge-ready report. An audit that arrives after the merge is a record, not a gate.
- Tell the teammate auto-merge is armed and authorize the `--disable-auto` safety-off (it isn't a
  merge), but don't lean on that toggle as the gate, because a bot approval can clear the last
  protection between two ticks.
- Leave it armed otherwise. Someone armed it deliberately, `--auto` bypasses no protection, and
  disarming another person's auto-merge is a decision, not housekeeping.
- **Refresh the stored commit title/body if the branch has grown since arming.** GitHub squashes using
  the snapshot taken when auto-merge was enabled, so anything pushed afterwards (including the loop's
  own review-fix commit) is missing from the merge commit message unless it's re-armed with a current
  body.

## Post-merge sweep — bots answer a request that outlived the PR

A review requested during the loop can complete *after* the merge; the request doesn't get cancelled
when the PR closes. Those late reviews are invisible to the loop, which has already stood down, and
they land on comments-on-a-merged-PR where nothing surfaces them again.

After every merge, re-read reviews and inline comments filtered to timestamps after the merge time.
Anything real there is now on the default branch: verify each finding against the merged file rather
than the PR diff, and take it to User as follow-up work. A late finding is not a reason to reopen
the PR, and never a reason to push to the default branch outside a PR.

## Direct-merge path

Only when no human code-owner approval is required, so the lead presses merge itself (otherwise use
auto-merge below). Once the audit is delivered (and, standard tier, User's given his go for a direct
press):

1. Audit the threads yourself, **per thread rather than by count**. Non-zero unresolved → send the
   teammate back. Equally disqualifying: any *resolved* thread carrying no reply of our own, which the
   unresolved count cannot show you. Both numbers must be zero before merging:
   ```bash
   gh api graphql -f query='query { repository(owner:"<o>",name:"<r>"){ pullRequest(number:<n>){
     reviewThreads(first:100){ nodes{ isResolved comments(first:20){ nodes{ author{login} } } } } } } }' \
     --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
            | {r:.isResolved, ours:([.comments.nodes[]|select(.author.login=="<pr-author>")]|length)}]
           | {unresolved:[.[]|select(.r==false)]|length,
              resolved_without_our_reply:[.[]|select(.r==true and .ours==0)]|length}'
   ```
   A teammate can close a thread without reading it, and the resulting green count is the most
   convincing wrong signal on the whole PR — findings that were never triaged sit behind it looking
   identical to ones that were.
2. `gh pr checks` all green (required and non-required, nothing running); `mergeable = MERGEABLE`;
   `mergeStateStatus` ∈ {CLEAN, HAS_HOOKS}; required reviews satisfied.
3. Merge: `gh pr merge <n> --repo <owner>/<repo> --squash --delete-branch`. Never `--admin`, never
   `--no-verify`-style bypasses. If protections reject it, back to the loop — no retries with force.
4. Wait for the merge to propagate before pulling (the git ref lags the API a few seconds; pulling early
   silently leaves the workspace behind):
   ```bash
   merge_sha=$(gh pr view <n> --repo <owner>/<repo> --json mergeCommit --jq .mergeCommit.oid)
   for i in {1..20}; do
     remote_main=$(git ls-remote origin main | awk '{print $1}')
     [ "$remote_main" = "$merge_sha" ] && break
     sleep 2
   done
   but clean --pull
   ```
   `but clean --pull` is the **GitButler** sync. On a **plain-git** repo substitute
   `git checkout main && git pull --ff-only`, then delete the merged local branch (`git branch -d gb/<name>` —
   expect a "not yet merged to HEAD" warning, which is just git comparing against the pre-checkout HEAD, not a
   sign the merge is missing). On a shunt siding, sync per the `shunt` skill.
5. Personal tier: confirm the squash commit shows signed/verified on GitHub, and wait for post-merge CI
   on the merge commit to succeed.
6. Stop the backstop Monitor and release the teammate (a short SendMessage so its transcript closes
   cleanly).

## Auto-merge — arm it once the PR is "complete, waiting only on the human review"

When everything the loop owns is done — 0 unresolved threads, no red build (CI green, or checks still
pending — `--auto` waits on pending), the audit delivered — and the **only** thing left is the required
human code-owner approval, **arm auto-merge automatically rather than sitting on a manual press**:

```bash
gh pr merge <n> --repo <owner>/<repo> --squash --auto --delete-branch
```

GitHub then merges the PR itself the moment the code-owner approval lands and every branch-protection
requirement is met. Confirm it armed (not merged, not bypassed):
`gh pr view <n> --json autoMergeRequest --jq '.autoMergeRequest.mergeMethod'` prints `SQUASH`.

- **Never the bypass.** `--auto` waits for requirements; it is NOT `--admin` / the UI's "Merge without
  waiting for requirements to be met (bypass rules)". Never arm that path.
- **Arm automatically in the waiting state — both tiers, no separate sign-off.** The moment the loop's
  work is done — 0 unresolved threads, no red build (pending is fine), and the only remaining requirement
  is the human code-owner approval — arm auto-merge. Do not gate arming on a User go: arming bypasses
  nothing (`--auto` waits for every requirement to be met), and the required human approval on GitHub is
  itself the human-eye gate where the audit gets reviewed. The audit is still produced and delivered for
  that reviewer. Personal tier is the same shape, usually with no required human approval, so it merges
  straight through once clean.
- **On ANY new comment/review while auto-merge is armed, disable it FIRST — before touching the
  comment:** `gh pr merge <n> --repo <owner>/<repo> --disable-auto`. Then work the comment (fix/decline/
  resolve) back to the clean complete state and re-arm auto-merge, looping back to this state before
  flicking it on again. Toggle it off even though branch protections (thread-resolution + last-push-
  approval) usually block a mid-comment merge on their own — don't rely on that. The teammate is
  authorized to run just the `--disable-auto` toggle the instant it detects a new comment (a safety-off,
  not a merge), then escalate.
- After auto-merge lands the PR, the post-merge steps still run: wait for propagation, `but clean --pull`,
  and the User-gated closing comment on any linked issue.
