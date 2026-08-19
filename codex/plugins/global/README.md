# global

General-purpose skills not tied to one project: secret management, plan review, and other cross-cutting helpers.

## Install

### Codex

```bash
codex plugin add global@gordon-codex-skills
```

## Skills

- **demo-video** — Record branded demo videos of a web-UI feature with Playwright, plus a shareable HTML artifact. Asks
- **plan-delegated** — Plan a piece of work, get the plan approved in full plan mode (team structure table up top), then
- **skillspector-scan** — Scan an AI agent skill for security vulnerabilities with the `skillspector` CLI, using the Anthropic provider (key pulled from 1Password). Only invoke when the user explicitly types /skillspector-scan — never trigger on a general request to "scan", "audit", or "check" a skill, because each run spends real Anthropic API money. Accepts a path, Git URL, zip, .md file, or directory and returns the scanner's report.
