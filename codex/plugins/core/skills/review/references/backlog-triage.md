# Backlog and Dependabot

Two targets that review many PRs in one run. Both map the whole set first, then review in batches,
and both stop at review or approval: `$review` never merges, rebuilds, retargets, or edits an
author's branch.

## Backlog: topology triage (step 2)

One table covering every open PR before any single PR is read. Loop over
`gh pr list --state open --json number,isDraft,author,baseRefName,headRefName,labels,title` with
`--jq` (titles carry control characters that break a naive JSON parse) and gather per PR:

| Field | How | Why |
|---|---|---|
| author | in the list | batch by author; a stack is usually one person |
| base branch | in the list | base not the default branch means the PR is stacked |
| mergeable, state | `gh pr view <n> --json mergeable,mergeStateStatus` | clean or conflicting; `BLOCKED` is usually just the review rule |
| merge commits | `git log origin/<default>..origin/<branch> --merges --oneline \| wc -l` | above zero: the branch merged main in; review via `gh pr diff` only, never `git log --patch`, or the merged-in commits read as the author's |
| merge base age | `git merge-base origin/<default> origin/<branch>` then its date | ancient base means heavy divergence |
| conflict files | read-only three-way dry run below | scope of a conflict, often one shared manifest |

```bash
base=$(git merge-base origin/<default> origin/<branch>)
git diff "$base"..origin/<branch> --name-only | while IFS= read -r f; do
  git show origin/<default>:"$f" >/dev/null 2>&1 || { echo "(new) $f"; continue; }
  git show "$base":"$f" >"$run/b"; git show origin/<default>:"$f" >"$run/o"; git show origin/<branch>:"$f" >"$run/t"
  mk=$(git merge-file -p "$run/o" "$run/b" "$run/t" 2>/dev/null | grep -cE "^(<<<<<<<|>>>>>>>)")
  [ "$mk" != 0 ] && echo "CONFLICT($mk) $f"
done
```

The `git` reads above need the refs fetched. When the local checkout is stale or absent, fill those
columns from `gh` only and mark them `not fetched` in the table; the lead never runs `git fetch` on
behalf of a reviewer subagent, and only runs it itself when the working copy is User's own.

Classify each PR with one label:

- **clean**: mergeable, zero conflict files.
- **linear stack**: base is another open PR's branch (`A -> B -> C`). Reviewed as one batch, deepest
  last, because a later PR's rationale lives in its ancestors.
- **sibling fan**: several PRs share one base. They look like a stack and are independent.
- **merge-commits**: merge commits in history. Review from `gh pr diff` only.
- **stale base**: the PR's version of a file and the default branch's have diverged into different
  artifacts (line-count and content check, not just a conflict count). A re-author, reported as such.
- **shared-manifest conflict**: many siblings each append to one shared file. Note it once in the
  triage so it is not re-diagnosed per PR.

`triage.json` holds the table. Print it in chat as the first thing after gather.

## Backlog: batching (step 3)

- Group by author first. A stack is always one batch. Group across authors only on a clear shared
  theme.
- One artifact per batch, one approve or hold call per PR inside it, with the evidence per PR sized
  to justify the call and no boilerplate repeated across PRs that share context.
- Session-scoped rules User states ("skip PRs where X is the reviewer unless I am assigned") apply
  for this run only and never get written anywhere.
- A PR that needs evidence-level scrutiny gets named in the report as a candidate for
  `$review <pr> --depth deep`; the backlog pass does not run the panel.

## Backlog with `--approve`: the sweep filter (step 7)

Deterministic gates decide which PRs may receive an approval. The lead judges whether the code is
sound; it never judges whether a PR was allowed to be looked at. A PR is eligible only when all of:

- not a draft;
- not authored by the account running the review (GitHub refuses self-approval anyway);
- not a bot author (`app/dependabot` and the like belong to the `dependabot` target);
- base is the default branch (a stacked PR's approval reads as blessing the whole stack);
- `mergeable` is `MERGEABLE` and the state is not `DIRTY` or `CONFLICTING`; `UNKNOWN` is transient
  after a push to the base branch, so report it and re-run later rather than treating it as a no;
- no reviewer's latest `APPROVED`-or-`CHANGES_REQUESTED` review is `CHANGES_REQUESTED` (a later
  `COMMENTED` review does not clear one; drop `COMMENTED` before taking each reviewer's latest);
- no review thread that is neither resolved nor outdated (GraphQL `reviewThreads`, the only place
  resolution lives; a plain comment saying "this sends the email to the wrong person" never blocks a
  PR otherwise);
- not already approved by this account at the current head SHA;
- small: a size label with prefix `XS` or `S`, or the repo's low-risk label. Labels vary per repo;
  read them from the list and say which matched.

Check state is not a gate for review: branch protection enforces checks on its own, and a running
pipeline is no reason to leave a small PR unread. It would be a gate for merging, which this skill
never does.

Approve only on no Blocker, no High, and no Medium. Lows go in the body. Body: two or three
sentences on what was verified (not a summary of the PR), the Lows, then the footer line
`Posted by $review backlog`. Anything held: post nothing, and the report says why in one line.

The report covers every PR the run looked at, approved and held alike, plus one line listing what
the eligibility gates excluded before review, so a PR that silently never got read is still visible.

## Dependabot (steps 2 to 7)

Gather: `gh pr list --author app/dependabot --state open --json number,title,url,headRefName,statusCheckRollup,body,additions,deletions,changedFiles --limit 100`.
Zero PRs: report "No open Dependabot PRs" and end. Per PR: `gh pr diff <n>`, `gh pr view <n> --json
mergeable,mergeStateStatus,reviewDecision`, `gh pr checks <n>`.

Extract from the title and diff: package, old and new version, change type (major, minor, patch),
ecosystem. Then, coverage first, every concern from:

- major bump; new transitive dependencies in the lockfile (count them); advisories named in the
  body; changes to scripts, CI files, or non-dependency files; new install or postinstall hooks;
- breaking-change or deprecation notes in the linked changelog; source changes beyond the manifest
  and lockfile; several packages bumped together with interdependencies;
- CI: `passing`, `failing`, `pending`, `no-checks`; existing review comments or change requests
  from anyone.

Classify: **safe** is a patch or minor bump, CI passing, no advisory unresolved, lockfile-only or
minimal manifest change, no scripts touched. Everything else, and every major bump, is
**needs-review** with the concerns listed. Borderline goes to `needs-review`.

Write-back with `--approve`: `safe` PRs only, one `gh pr review <n> --approve --body-file` each, in
ascending PR number, body:

```text
Dependabot review: <package> <old> to <new> looks safe.

- CI: <status>
- Change type: <patch|minor>
- Breaking changes: none found
- Security advisories: <none | list>

Posted by $review dependabot
```

`needs-review` PRs get nothing posted. Merging, `@dependabot rebase` comments, and the local build
after landing are User's or `$work`'s; the report lists the safe PRs as ready to merge and the
flagged ones with their concerns.
