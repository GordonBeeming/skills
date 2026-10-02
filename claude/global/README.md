# global

General-purpose skills not tied to one project: secret management, plan review, and other cross-cutting helpers.

## Install

### Claude Code

```bash
claude plugin install global@gordon-skills
```

### Codex

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in claude/global/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Skills

- **skillspector-scan** — Scan an AI agent skill for security vulnerabilities with the `skillspector` CLI, using the Anthropic provider (key pulled from 1Password). Only invoke when the user explicitly types /skillspector-scan — never trigger on a general request to "scan", "audit", or "check" a skill, because each run spends real Anthropic API money. Accepts a path, Git URL, zip, .md file, or directory and returns the scanner's report.
