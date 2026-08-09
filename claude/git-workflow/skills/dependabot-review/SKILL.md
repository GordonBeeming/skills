---
name: dependabot-review
description: "Review and batch-merge open Dependabot pull requests. Only invoke explicitly with /dependabot-review. Lists all open Dependabot PRs, analyzes each for security and compatibility concerns, presents a plan with approval comments, then approves and merges safe PRs on user confirmation."
user_invocable: true
---

# Skill: Dependabot PR Review and Batch Merge

## Purpose

Fetch all open Dependabot PRs from a GitHub repository, analyze each for security and compatibility risks, present a reviewable plan, then approve and merge all user-approved PRs in batch.

## Workflow

### 0. Sync local workspace

Before doing anything, pull the latest from main so the local workspace is current:

```bash
but clean --pull
```

This avoids merge conflicts from stale local state and ensures lockfile diffs are accurate.

### 1. Identify the target repo

Detect from the current directory:

```bash
gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"'
```

If the user specified a repo as an argument, use that instead. If detection fails, ask the user.

### 2. List open Dependabot PRs

```bash
gh pr list --author app/dependabot --state open --json number,title,url,headRefName,statusCheckRollup,body,additions,deletions,changedFiles --limit 100
```

If zero PRs are found, report "No open Dependabot PRs" and stop.

### 3. Analyze each PR

Below **5 open PRs**, just analyze them yourself in sequence — spawning subagents for a handful of PRs costs more than it saves. At **5 or more**, delegate: this is independent per-PR work that fans out cleanly, so spawn one subagent per PR, batched into groups of **at most 5 concurrent subagents** (queue the rest, don't launch them all at once). Each agent should:

#### 3a. Fetch the diff

```bash
gh pr diff {number}
```

#### 3b. Fetch PR details and CI status

```bash
gh pr view {number} --json title,body,statusCheckRollup,mergeable,mergeStateStatus,reviewDecision
gh pr checks {number}
```

#### 3c. Determine version change details

From the PR title and diff, extract:
- **Package name** being updated
- **Old version** and **new version**
- **Change type**: major, minor, or patch (based on semver comparison)
- **Ecosystem**: npm, NuGet, pip, etc.

#### 3d. Security analysis

Check for these concerns:
- **Major version bumps** — flag as `needs-review` (potential breaking changes)
- **New transitive dependencies** added in lockfile — note count
- **Known security advisories** mentioned in PR body (Dependabot includes these)
- **Suspicious changes** — modifications to scripts, CI files, or non-dependency files
- **Permission/scope changes** — new install scripts, postinstall hooks

#### 3e. Compatibility analysis

Check for:
- **Breaking change indicators** in PR body (Dependabot links to changelogs)
- **Source code changes** vs lockfile-only changes — source changes need more scrutiny
- **Multiple packages updated together** — check for interdependencies
- **Deprecation notices** mentioned in the PR body

#### 3f. CI status check

Classify CI as:
- `passing` — all checks green
- `failing` — any check failed (flag as `needs-review`)
- `pending` — checks still running (flag as `needs-review`)
- `no-checks` — no CI configured

#### 3g. Classify the PR

Each PR gets one classification:
- **`safe`** — patch/minor bump, CI passing, no security concerns, lockfile-only or minimal source changes
- **`needs-review`** — major bump, CI failing/pending, security concerns flagged, or source code changes detected

At this stage, aim for coverage: report every concern you noticed from steps 3d–3f, including ones you are unsure about, rather than filtering them out. When borderline between `safe` and `needs-review`, classify as `needs-review` and note why. The plan in step 4 (and the user's review of it) is where the bar gets applied — a concern surfaced there can be waved through, but one you dropped here never reaches the user.

Each agent returns a structured summary: PR number, package, old version, new version, change type, CI status, classification, and any concerns.

### 4. Present the plan (plan mode)

Enter plan mode using the `EnterPlanMode` tool (load it first via `ToolSearch` with `select:EnterPlanMode`).

Write the plan file with:

#### Summary table

| # | Package | Version Change | Type | CI | Classification | Concerns |
|---|---------|---------------|------|-----|----------------|----------|
| 534 | fast-xml-parser | 5.3.3 → 5.5.11 | minor | passing | safe | — |
| ... | ... | ... | ... | ... | ... | ... |

#### Safe PRs — proposed approval comments

For each `safe` PR, show the exact approval comment that will be posted:

```
Dependabot review: {package} bump from {old} to {new} looks safe.

- CI: {status}
- Change type: {patch|minor}
- Breaking changes: none detected
- Security advisories: {none | list}

Auto-approved via /dependabot-review
```

#### Flagged PRs — concerns

For each `needs-review` PR, explain:
- What was flagged and why
- Recommendation (merge anyway, skip, or investigate further)

#### Merge strategy

State the merge method that will be used. Detect the repo's preferred merge method:

```bash
gh api repos/{owner}/{repo} --jq '.allow_squash_merge, .allow_merge_commit, .allow_rebase_merge'
```

Prefer squash merge if available, otherwise merge commit.

Then call `ExitPlanMode` to present to the user for approval.

### 5. Execute approved merges (batch)

After the user approves the plan:

For each approved PR (in order, lowest PR number first):

#### 5a. Approve the PR

```bash
gh pr review {number} --approve --body "{approval_comment}"
```

#### 5b. Merge the PR

```bash
gh pr merge {number} --squash --auto
```

If `--auto` is not available or the merge fails:

```bash
gh pr merge {number} --squash
```

#### 5c. Handle merge conflicts

Lockfile-only PRs (especially root `package-lock.json`) commonly conflict with each other because each PR regenerates the entire lockfile. When a merge fails due to conflicts:

1. **Do not stop the batch** — skip the conflicted PR and continue with the remaining PRs
2. Track all conflicted PRs in a separate list
3. After the batch completes, comment `@dependabot rebase` on each conflicted PR:

```bash
gh pr comment {number} --body "@dependabot rebase"
```

Dependabot will auto-rebase these once the previously merged PRs land on main. They are already approved, so they should merge automatically once conflicts resolve.

#### 5d. Handle other failures

If any PR fails to merge for reasons other than conflicts (CI failure, branch protection violation, etc.):
1. Report which PR failed and why
2. **Stop processing remaining PRs** — do not continue the batch
3. Present the failure to the user and ask how to proceed

### 6. Sync local workspace and verify build

After all merges and rebase requests are done, pull the latest changes locally:

```bash
but pull
```

**Verify the pull actually worked** — check that `but` reports the workspace is up to date and the latest merged commits are present. If the pull fails or reports issues, flag it to the user.

Then verify the project still builds:

```bash
dotnet build Contoso.Product.slnx
```

If the build command is not obvious from the repo, check for a `CLAUDE.md`, `Makefile`, `package.json` scripts, or similar. Run whatever the repo's standard build command is.

If the build fails, report the errors to the user immediately — the merged dependency updates may have introduced incompatibilities that need fixing.

### 7. Report results

After all approved PRs are processed, report:

```
## Dependabot Review Complete

- Merged: {count} PRs
- Conflicted (rebase requested): {count} PRs
- Skipped (flagged): {count} PRs
- Failed: {count} PRs
- Local build: {passing | failing}

### Merged
- #{number} {package} {old} → {new}
- ...

### Conflicted (awaiting Dependabot rebase)
- #{number} {package} — @dependabot rebase commented
- ...

### Skipped
- #{number} {package} — {reason}
- ...
```

## Important notes

- Never force-merge or bypass branch protections
- If CI is failing on a PR, do not approve or merge it — flag it for user review
- If a PR has existing review comments or change requests from other reviewers, flag it rather than overriding
- The approval is posted as the authenticated GitHub user (the person running the skill)
- Major version bumps always require explicit user approval in the plan step, even if CI passes
