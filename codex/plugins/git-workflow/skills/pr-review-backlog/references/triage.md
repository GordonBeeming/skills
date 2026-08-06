# Topology triage — map the whole backlog first

The goal of this pass is one table covering every open PR, built **before** you review or touch any single one. The structure it reveals (stacks, fans, poison, stale bases) decides the order and the method for everything after it.

## Data to gather per PR

| Field | How | Why it matters |
|---|---|---|
| author | `gh pr view N --json author` | Batch by author; spot one person's stack |
| base branch | `gh pr view N --json baseRefName` | base ≠ `main` → the PR is **stacked** on another |
| mergeable + state | `gh pr view N --json mergeable,mergeStateStatus` | clean vs conflicting; `BLOCKED` is usually just the review gate, not a conflict |
| merge-commits | `git log origin/main..origin/<branch> --merges --oneline \| wc -l` | **> 0 = poison.** Never `but apply` it (corrupts the workspace) |
| merge-base | `git merge-base origin/main origin/<branch>` | an ancient base = heavy divergence / likely re-author |
| conflict files | per-file `git merge-file` dry-run (below) | tells you the *scope* — often just one shared manifest |

Read-only conflict-file scan (no apply, writes only to `/tmp`):

```bash
base=$(git merge-base origin/main origin/<branch>)
git diff $base..origin/<branch> --name-only | while IFS= read -r f; do
  git show origin/main:"$f" >/dev/null 2>&1 || { echo "(new) $f"; continue; }
  git show $base:"$f" >/tmp/b; git show origin/main:"$f" >/tmp/o; git show origin/<branch>:"$f" >/tmp/t
  mk=$(git merge-file -p /tmp/o /tmp/b /tmp/t 2>/dev/null | grep -cE "^(<<<<<<<|>>>>>>>)")
  [ "$mk" != 0 ] && echo "CONFLICT($mk) $f"
done
```

Loop the gather over `gh pr list --state open --json number,isDraft --jq 'map(select(.isDraft==false))'`. Use `gh --jq` (not piping raw JSON through `python -c`) — PR titles carry control characters that break a naive JSON parse.

## Classification

Assign each PR one label — it dictates the Phase 3 method:

- **clean-mergeable** — `MERGEABLE`, zero conflict files. Ready (subject to the gate).
- **linear stack** — base is another open PR's branch, forming a chain `A → B → C`. Review/land as a unit; land the deepest once (see `resolve.md`).
- **sibling fan** — several PRs share one base (often a now-merged parent). They *look* like a stack but are independent, so each needs its own rebuild. The tell: same base branch, no chain between them.
- **merge-commit-poisoned** — `--merges` count > 0. The author merged `main` (or a sibling) into their branch in plain git. GitButler can't rebase it and `but apply` produces a destructive tree. Flag it loudly.
- **stale-base / structural-rewrite** — the PR's file and `main`'s have diverged into different artifacts (e.g. a 390-line vs 2438-line `apps.bicep`). Confirm with a line-count / content comparison, not just a conflict count. This is a re-author, not a merge.

## The recurring "shared-manifest" conflict

When many sibling PRs each append to **one shared file** (a CI manifest, a build-file list, a registry seed), every one of them conflicts on that file — but it's never a real divergence, just "keep `main`'s entries and add this PR's." Note it once in the triage so it isn't re-diagnosed per PR. It's a union, not a decision.

## Output

A table (and usually a durable artifact) grouping the PRs by batch, with each PR's label, conflict scope, and a one-line "what's required" — e.g. "clean, admin-ready", "1 conflict: the shared validator manifest", "poison: needs file-ops rebuild", "re-author: base file replaced". That table is what the user steers the rest of the session from.
