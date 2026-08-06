# git-workflow

PR lifecycle automation: autopilot PRs, branch and PR review, diff-only change maps, backlog triage, Dependabot batches, GitHub issue planning and security alerts, file uploads.

## Install

### Codex

```bash
codex plugin add git-workflow@gordon-codex-skills
```

## Skills

- **review-pr** — Evidence-backed pull request review. Use when the user gives a PR URL, branch, or diff range and
- **pr-review-backlog** — Use when clearing or triaging a BACKLOG of many open PRs in one session — "review all the open
- **dependabot-review** — Review and batch-merge open Dependabot pull requests. Only invoke explicitly with /dependabot-review. Lists all open Dependabot PRs, analyzes each for security and compatibility concerns, presents a plan with approval comments, then approves and merges safe PRs on user confirmation.
- **github-issue-planner** — Plan implementation for a GitHub issue. Use this skill whenever the user pastes a GitHub issue URL (e.g., https://github.com/org/repo/issues/123), mentions a GitHub issue number in the context of a repo, or asks to plan work for a bug, PBI, or feature tracked in GitHub Issues. Also trigger when the user says things like 'plan this issue', 'look at this bug', or provides a GitHub link with minimal other instructions — the intent is almost always 'fetch the issue, understand the codebase, and give me a plan'. Even a bare URL with no other text should trigger this skill.
- **github-security-alerts** — Review and remediate GitHub security alerts (Dependabot, code scanning, secret scanning). Only invoke explicitly with /github-security-alerts. Analyzes open alerts, categorizes as fix or dismiss with reasoning, groups fixes into issues sized for independent agent work, and handles public repo safety.
- **github-upload-file** — Upload a local image or file to GitHub from the CLI so it can be embedded in an
