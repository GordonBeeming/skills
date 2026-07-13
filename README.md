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

Codex has its own marketplace system and reads this repo's `.claude-plugin/marketplace.json` directly — no
separate manifest needed. Add the marketplace once, then install whichever sets you want:

```bash
codex plugin marketplace add GordonBeeming/skills
# or, over a full Git URL:
codex plugin marketplace add https://github.com/GordonBeeming/skills

codex plugin add <set>@gordon-skills
```

`codex plugin add` copies the set into Codex's own plugin cache — after this repo publishes an update, run
`codex plugin marketplace upgrade` and re-run `codex plugin add <set>@gordon-skills` to pick it up.

## Attribution

Some skills here are vendored from other people's repos rather than written from scratch. See
`ATTRIBUTION.md` for the full list of sources and licenses.
