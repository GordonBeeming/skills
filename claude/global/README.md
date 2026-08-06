# global

General-purpose skills not tied to one project: secret management, codebase memory, plan review, and other cross-cutting helpers.

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

- **plan-delegated** — Plan a piece of work, get the plan approved in full plan mode (team structure table up top), then
