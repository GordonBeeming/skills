# content

Writing and media production: voice work, long-form and social content, branded infographics and decks, and demo-video recording and QA.

## Install

### Claude Code

```bash
claude plugin install content@gordon-skills
```

### Codex

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in claude/content/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Skills

- **video-qa** — QA technical product-demo and software-walkthrough MP4s against an intended storyboard and return a
