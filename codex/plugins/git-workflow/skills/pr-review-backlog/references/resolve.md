# Resolve & merge — the opt-in path

Only enter this when the user has explicitly asked you to land/fix the PRs. Fixing someone else's branch on their behalf is the exception, not the default. All git work goes through `but`; stay on `gitbutler/workspace`.

## Gate / override rules

A PR is safe to admin-merge when: you're the latest approver, no failing checks (ignore a known repo-wide failure like a `submit-nuget` job that fails everywhere), and no open review threads. A `BLOCKED` state with everything else green is usually just the CODEOWNERS/team-review ruleset — `gh pr merge N --squash --admin` is the path when the operator holds admin. Retarget a stacked PR to `main` first: `gh api -X PATCH repos/<owner>/<repo>/pulls/N -f base=main`.

Cosmetic review-bot threads (style/naming/optimisation nits) can be resolved as non-blocking once you've assessed them; say why in the resolve/approve note. Apply a fix on the author's behalf when it's trivial and clearly correct; otherwise resolve as non-blocking. A **high-priority** flag gets verified, not waved through. It may still be a false positive (e.g. a column excluded from a code path), but confirm before resolving.

## Per-classification method

### clean-mergeable
Retarget to `main`, confirm the gate, admin-merge.

### linear stack (A → B → C)
Rebuild only the **deepest** PR (C) onto `main` — it carries A and B. Merge it once (squash), then **close** A and B with a comment noting they landed via C. Don't rebuild each link; that's wasted work and risks drift.

### sibling fan (A, B, C all on one parent)
Rebuild **each** onto `main` individually. "Merge the last" does nothing — they're independent. Watch for cross-sibling drift in shared files (registry/manifests): after each merge `main` grows, so re-verify the next sibling stays a superset.

### merge-commit-poisoned — file-ops on a fresh branch
Never `but apply` it. The clean rebuild that doesn't corrupt the workspace:

1. Get the branch's **local name freed** (the operator deletes local branches in the GitButler GUI; `git branch -D` is typically blocked).
2. `but clean --pull`, then `but branch new <exact-PR-branch-name>` on clean `main`. Never apply the poisoned branch.
3. Build content with **file ops only**: `base` = the commit the branch forked from (read it from its `Merge … (<sha>)` commit, or `git merge-base origin/main origin/<parent>`). For each file in `git diff <base>..origin/<branch> --name-only`: if it exists in `main` → `git merge-file -p <main> <base> <branch>` (3-way); else write `git show origin/<branch>:<f>` verbatim.
4. Resolve conflicts by intent (see shared-manifest + registry notes below).
5. Verify (next section), commit, `but push --with-force`, retarget to `main`, resolve threads, admin-merge.

### stale-base / structural-rewrite
The PR's file and `main`'s are different artifacts. Don't merge — **take `main`'s version and graft the PR's genuine new feature onto it**, modelled on `main`'s existing equivalent (e.g. a new scheduled job modelled on the existing build job in the same module). Drop the PR's now-obsolete baggage: duplicate resources `main` already defines, superseded mechanisms, unused wiring. Scope it to the minimal coherent feature. If it's deploy-critical and you can't run the deploy, **flag it for a dry-run** before it's relied on.

## Verify the intent survived — markers-clean is not enough

The 3-way grind silently does two damaging things, neither of which leaves a conflict marker:

- **restores files the PR deleted** (it takes `main`'s version of a to-be-deleted file). Re-check `git diff <forkpoint>..<branch> --diff-filter=D` and re-apply any dropped deletion.
- **drops the PR's changes to files `main` also edited** (takes `main`'s side of a co-edited file). The check is not "no markers" — it's: diff the rebuilt branch against the PR's own fork-point and confirm its real additions are all present.

For registry / metadata-driven slices: confirm the entity is a **superset** of `main` (nothing dropped), the new entity is **active** (`is_active=1`, not just present), and any "enabled" flag is a **union** across the groups that own it. For build/CI manifests: confirm `main`'s entries are retained **and** the PR's are added.

## Shared-manifest union

When the conflict is a shared list everyone appends to: take `main`'s complete version, then insert only this PR's new entries (extract them from the PR's file). De-dup obvious duplicates while you're there. Don't take either whole side — `main`'s lacks the PR's additions, the PR's lacks everything merged since.

## Tooling gotchas (these cost real time)

- Don't `export LC_ALL=C` for the grep/awk used in resolution — it makes `grep` choke on em-dash UTF-8 in comments and silently match nothing.
- Use **literal refs** in `git show <ref>:<path>`, not a shell `$var` (a var has returned empty in practice).
- awk variable name can't be `close` (it's a builtin).
- `but apply` of an *empty-named local branch* can drag in stale commits — verify the commit's actual file set (`git show --stat`) after committing, not just the working-tree diff.
- After any rebuild, sanity-check the tree is healthy (a known `main` file still present) before pushing — the apply-corruption signature is hundreds of phantom deletions.
