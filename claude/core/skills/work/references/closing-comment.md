# Closing comments on linked issues

Applies to every issue the PR body links (`Closes #N`, `Fixes #N`, `Resolves #N`, or the issue the run
started from). GitHub auto-closes without context; the comment supplies it.

## The choice, made once, at publish time

Right before `gh pr ready` (step 6 of the cycle), one `AskUserQuestion` per PR, "Closing comment on
#<n>?", skipped when `--closing` is on the command or the profile's `pr.closingComment` is anything
other than `ask` (that value is the answer; the flag still wins over the profile). It is asked here,
while the run is alive, whatever `pr.autoMerge` says: on `false` the merge happens later, often in
another session or days on, and nothing is watching then.

- `auto`: draft from the template, post when the PR is merged.
- `review`: draft now, show it for approval in plan mode (`EnterPlanMode`, write the draft to the plan
  file, `ExitPlanMode`), then post the approved wording when the PR is merged. A rejection with notes
  means revise and show again.
- `skip`: post nothing; the report says so.

The same question carries a second part: "Close #<n> on merge?" (`yes` / `no`). `yes` means the PR
body gets `Closes #<n>` (one keyword per issue; a comma list closes only the first) and the sweep
closes it by hand if GitHub did not. `no` is right when the issue has work left after this PR.

Unattended with no flag and profile `ask`: `skip`, and the report says `closing skipped (no --closing given)`.

## The draft file

One file per issue, `<run dir>/closing-<issue>.md`, written the moment the choice is `auto` or the
`review` wording is approved:

```text
---
pr: https://github.com/<o>/<r>/pull/<pr-n>
repo: <o>/<r>
issue: <n>
close: yes|no
---
Merged in #<pr-n> ({{merge_sha}}).
Cause: <one line, tied to the symptom the issue reported>.
Fix: <one or two lines on what changed>.
<Only when something could not be verified locally:> @<reporter> could you retest <the specific thing> on <platform/env>?
```

Three to six lines, plain, no headings, written as User. `{{merge_sha}}` is filled at post time.

## Posting

- The run merges the PR itself (direct merge, or auto-merge that lands while the run is polling):
  post each draft with `gh issue comment <n> --repo <o>/<r> --body-file <run dir>/closing-<n>.md`
  after replacing `{{merge_sha}}`, append the marker `<!-- closing-comment pr=<pr-n> -->`, write the
  comment URL to `<run dir>/closing-<n>.md.posted`, record it in `run.json.outputs.closingComments`,
  and close the issue by hand if `close: yes` and it is still OPEN.
- The run does not merge (`pr.autoMerge` false, or the session ends first): the drafts stay in the
  run dir and the done report says `closing drafted (posts on merge: <paths>)`. The
  `pr-closing-sweep` routine runs `${CLAUDE_PLUGIN_ROOT}/scripts/closing-sweep.sh --apply` every
  few hours: for every draft without a `.posted` sibling whose PR is `MERGED`, it posts, closes when
  asked, and writes `.posted`. It is idempotent (marker check) and never posts on an unmerged PR.
  `/pr --closing auto` on a merged PR does the same thing at once.

## Verify the close

After a merge, check instead of trusting the body:

```bash
for n in <issue numbers>; do printf "%s=" "$n"; gh issue view $n --repo <o>/<r> --json state -q .state; done
```

An issue that was already closed still gets its comment: audit trail over state. The done report lists
the issues commented on, the drafts waiting for a merge, or "no linked issues".
