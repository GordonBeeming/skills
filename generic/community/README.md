# community

Skills for submitting to and interacting with community platforms and directories. Currently: submitting a tool to Shane Hanselman's Tiny Tool Town.

## Install

### Claude Code

```bash
claude plugin install community@gordon-skills
```

### Codex

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in generic/community/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Skills

- **submit-tinytooltown-tool** — Submit a tool to Shane Hanselman's Tiny Tool Town (tinytooltown.com). Use when the user wants to add, submit, or list a tool on Tiny Tool Town, says things like 'submit this to tiny tool town', 'add my tool to tinytooltown', 'TinyToolTown submission', or points at a repo and asks to get it onto Tiny Tool Town. Downloads the live submission template each run, analyzes the tool's repo, shows a plan of the exact issue it will open, and creates it via the gh CLI only after approval.
