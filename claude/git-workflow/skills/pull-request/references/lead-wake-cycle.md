# Reference: the lead's wake cycle

Arm this the moment the teammate is spawned. It is the mechanism behind "Keep User in the loop" and
"escalate within moments" in SKILL.md — read this before the first wake fires.

## Arm the cycle

Arm the lead's own wake cycle at **~10 minutes** (Monitor poll or scheduled wakeup), phase-aligned to the
teammate's 5-minute ticks: every teammate tick report carries its timestamp, so on each wake compute when
the next tick is due.

## Don't accuse the teammate of missing a step on one narrow query

Before telling the teammate a request never landed (a bot not nudged, a reviewer not added), check
properly. The review-request timeline is available two ways, and they don't settle at the same moment:

```bash
# live, and the one to trust for "did this land"
gh api graphql -f query='{repository(owner:"<o>",name:"<r>"){pullRequest(number:<n>){
  timelineItems(first:60, itemTypes:[REVIEW_REQUESTED_EVENT]){nodes{... on ReviewRequestedEvent{
    createdAt requestedReviewer{... on Bot{login} ... on User{login}}}}}}}}'

# needs --paginate, and can lag the event by a minute or two
gh api repos/<o>/<r>/issues/<n>/timeline --paginate --jq '.[] | select(.event=="review_requested")'
```

An unpaginated REST read taken seconds after the event returns an incomplete list, and **absence in that
result is not evidence of absence**. Querying once, seeing two events where there should be three, and
announcing "you never requested it" is a false accusation that costs a round trip and sends the teammate
re-doing work it already did correctly.

State it as a question until the live query confirms it ("I only see two requests, can you check?"), not as
settled fact. And when the teammate pushes back with a timestamp and a different query, re-check before
holding the line: it's often right, and a lead who re-asserts a wrong correction teaches it to stop pushing
back at all, which costs far more than the original mistake ever did.

## Reading CI without false alarms

**Scope the backstop's CI read to the current head SHA** — `gh api repos/<o>/<r>/commits/<head>/check-runs`
for the `CI Gate` conclusion — not `statusCheckRollup`/`gh pr checks`. After each new push, the prior
head's deploy/Kiota jobs land as `CANCELLED`/`FAILURE` (superseded), and the rollup surfaces those as a
red CI Gate that isn't real; a head-scoped check-run read avoids that repeated false alarm.

Undrafting (or any re-trigger) can create **two** check-runs of the same name on the *same* head, so a naive
`[…][0].conclusion` can read a stale queued duplicate as `pending` while the real run is green. Select the
newest completed same-named run (sort by `started_at`, or take the one whose `conclusion != null`) rather
than `[0]`. This is not specific to `CI Gate` — it hits any check the re-trigger re-queues, including
non-blocking ones.

**The losing duplicate can stay `in_progress` forever rather than resolving to `cancelled`.** The tell is
two same-named runs on one head with `started_at` seconds apart, one `completed` and one that never moves.
Nothing will settle it, so treating it as "still running" parks the merge indefinitely — read the completed
one, and if the hung name is a non-blocking check, merge on the real CI jobs.

For watching the full post-ready test matrix, `gh pr checks <n> --json name,bucket` is cleaner than raw
check-runs — GitHub dedupes superseded runs to the latest per name, so `bucket`
(pass/fail/pending/skipping) reflects the true rollup without hand-filtering cancelled infra jobs.

## Scheduling the next wake

Next tick due within ~a minute → stay up for it and handle whatever it raises; otherwise schedule the
next wake to land just after the teammate's next expected tick, so escalations and merge-ready reports
get answered within moments of being sent instead of sitting half a cycle.

Teammate messages also arrive push-style and wake the lead on their own — the 10-minute cycle is the
backstop for a teammate that's gone silent: two consecutive expected ticks with no report means treat it
as stalled — check its transcript, message it, respawn if dead. Verify liveness before ever ending a turn
with "waiting".

**Read the tree before concluding a teammate has stalled.** A teammate can finish a step and go idle *without reporting it*, so silence is ambiguous: it means "hasn't started" and "finished but didn't say so" equally. Check `git log`/`git status` and `git ls-remote` for the branch before nudging — a signed commit sitting locally and unpushed looks identical to no progress from the message log alone, and nudging "you haven't started" at a teammate that already did the work wastes a round trip and invites it to redo something. The cheap read settles it; the nudge then carries the real gap ("your commit landed, the push didn't").

Expect the teammate's 5-minute self-wake to be unreliable: its wait-notification often never re-fires
after the first tick, so every subsequent tick needs a lead nudge — the backstop cycle carries the whole
run. Treat a lead nudge per cycle as normal operation, not a failure, and when the backstop fires, check
the PR state yourself (`gh pr view` + the reviewThreads GraphQL) before nudging so the nudge carries the
current facts (new reviews, thread counts) instead of just "are you alive".

## Keep User posted on every wake

Each time the lead wakes — a teammate tick lands or the backstop fires — post User a short progress
update in the main conversation, and **always include the PR URL** so it's one click away. State the
current phase and the numbers that moved (unresolved threads, CI status, clean-streak toward ready, what
the teammate just did). Do this even when nothing needs his decision: keeping him informed is separate
from escalating to him, and going silent between escalations is a failure mode — he wants to see steady
progress with the link in reach, not a wall of quiet until the merge-audit appears.
