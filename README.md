# skills

This is a curated selection of my Claude Code skills, published once they're stable enough to share.

A "set" is a themed group of skills you install together (one for iOS work, one for git/PR workflows, and so
on). Sets appear here as skills get published, so check `.claude-plugin/marketplace.json` for what's
currently available rather than assuming a fixed list of names.

## Install

### Claude Code

Add this repo as a marketplace, then install whichever sets you want:

```bash
claude plugin marketplace add git@github.com:GordonBeeming/skills.git
# or, over https:
claude plugin marketplace add https://github.com/GordonBeeming/skills.git

claude plugin install <set>@gordon-skills
```

Sets install at user scope, so once installed they're available in every project.

### Codex

Codex doesn't have a marketplace concept — a skill is a directory under `~/.codex/skills/` (or
`.agents/skills/` inside one project, for a repo-scoped install). Installing a set means symlinking every
skill in that set's `skills/` folder:

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in <folder>/<set>/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Attribution

Some skills here are vendored from other people's repos rather than written from scratch. See
`ATTRIBUTION.md` for the full list of sources and licenses.
