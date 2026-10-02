# git-workflow

PR lifecycle automation: autopilot PRs, branch and PR review, diff-only blind reviews, backlog triage, unattended approval sweeps, Dependabot batches, GitHub issue planning and security alerts, file uploads.

## Install

### Claude Code

```bash
claude plugin install git-workflow@gordon-skills
```

### Codex

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in claude/git-workflow/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Skills

- **github-security-alerts** — Review and remediate GitHub security alerts (Dependabot, code scanning, secret scanning). Only invoke explicitly with /github-security-alerts. Analyzes open alerts, categorizes as fix or dismiss with reasoning, groups fixes into issues sized for independent agent work, and handles public repo safety.
- **github-upload-file** — Upload a local image or file to GitHub from the CLI so it can be embedded in an
