# Diff resolution

Determine exactly what code is under review, and what to diff it against, before doing anything else.
Detection runs in a fixed order; the first match that fits wins. Print a one-line scope summary and
proceed — only stop to ask when the base or target is genuinely ambiguous.

All `git` commands here are **read-only** (`status`, `log`, `diff`, `merge-base`, `rev-parse`). Never
mutate state during resolution.

## Order of detection

### 1. Shunt siding (highest priority)

The code being validated may live in a shunt siding worktree — an isolated container instance that is a
git worktree off the repo's HEAD — and **several sidings may be running at once**.

```
shunt-dev active --json
```

- Non-shunt repo, or the command exits non-zero → skip to step 2.
- Shunt app → the JSON lists sidings with their edit paths (`<repos>/.shunt[-channel]/<project>/<siding>/src`).

Pick the siding:

- Invoked from **inside** a siding worktree (cwd is under a siding `src`) → review that siding.
- Exactly **one** siding active → review it.
- **Multiple** sidings active → **ask which** via `AskUserQuestion` (offer each siding by name, plus an
  "all — review each and compare" option).
- A siding name was passed by the user → use it.

Compute the diff inside the siding worktree with **plain git** (sidings use plain git, not GitButler):

```
cd <siding>/src
base=$(git merge-base HEAD "$(git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null || echo origin/main)")
git diff "$base"...HEAD          # committed changes on the siding branch
git status --porcelain           # + uncommitted working-tree changes
git diff                         # uncommitted unstaged
git diff --staged                # uncommitted staged
```

Review scope = committed diff since base **plus** uncommitted changes.

**Verification against this siding runs through the guest**, not the host shell:
`shunt-dev run <cmd>` (e.g. `shunt-dev run aspire logs`, `shunt-dev run sh -c "dotnet test …"`). The
host shell can't see the guest's processes, logs, or networking.

### 2. GitButler workspace (main repo)

If not a siding and `git branch --show-current` is `gitbutler/workspace` (or `but` reports a workspace):

```
but status            # applied virtual branch(es) / stack, commit order, conflicts
but status -fv        # when per-commit file/hunk detail is needed
```

The "branch I'm working on" is the applied virtual branch/stack, not a plain git branch. Diff = the
applied branch's commits **plus** uncommitted changes, versus the merge-base with the default branch:

```
base=$(git merge-base HEAD "$(git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null || echo origin/main)")
git diff "$base"...HEAD
git status --porcelain     # + uncommitted
```

If several virtual branches are applied and it's unclear which is under review, ask which stack/branch
to scope to (default: the one with uncommitted work, else the most recently committed).

Use read-only `git` for the diff math; use `but` for anything that reads GitButler's own state.

### 3. Plain git branch

Not a siding, not a GitButler workspace, on a normal feature branch:

```
default=$(git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null || echo origin/main)
base=$(git merge-base HEAD "$default")
git diff "$base"...HEAD
git status --porcelain     # + uncommitted (unstaged + staged, as above)
```

If `origin/HEAD` isn't set, fall back to `origin/main`, then `origin/master`; if none exist locally,
ask for the base branch.

### 4. Remote PR

A PR URL or number was passed, and no local checkout is in play:

```
gh pr view <pr> --json title,author,baseRefName,headRefName,files,additions,deletions,isDraft,reviewDecision,mergeStateStatus
gh pr diff <pr>
gh pr checks <pr>
```

Reuse the `review-pr` skill's evidence conventions (query GraphQL `reviewThreads` for unresolved-thread
state — `--json reviews` alone misses resolution). If the user wants local validation of PR code, apply
the branch through the `gitbutler` skill (`but`) — never raw `git checkout`, never work from
`origin/<branch>` refs alone.

## Scope summary (always print)

```
Reviewing: <siding|branch|stack|PR>  vs  <base>
Changed:   <N files, +A / -D lines>
Context:   <shunt siding "<name>" | gitbutler workspace | plain branch | remote PR #N>
```

## Excluding noise

Don't review generated/vendored files — respect `.gitignore` and skip lockfiles, `dist/`, `bin/`,
`obj/`, `node_modules/`, snapshots, and generated clients, unless the change is specifically about
them. Note anything skipped in the scope summary so the exclusion is observable, not silent.
