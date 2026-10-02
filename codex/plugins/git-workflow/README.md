# git-workflow

PR lifecycle automation: autopilot PRs, branch and PR review, diff-only blind reviews, backlog triage, unattended approval sweeps, Dependabot batches, GitHub issue planning and security alerts, file uploads.

## Install

### Codex

```bash
codex plugin add git-workflow@gordon-codex-skills
```

## Skills

- **github-security-alerts** — Review and remediate GitHub security alerts (Dependabot, code scanning, secret scanning). Only invoke explicitly with /github-security-alerts. Analyzes open alerts, categorizes as fix or dismiss with reasoning, groups fixes into issues sized for independent agent work, and handles public repo safety.
- **github-upload-file** — Upload a local image or file to GitHub from the CLI so it can be embedded in an
