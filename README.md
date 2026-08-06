# skills

This is a curated selection of my Claude Code and Codex skills, published once they're stable enough to share.

A "set" is a themed group of skills you install together (one for iOS work, one for git/PR workflows, and so
on). Sets appear here as skills get published, so check `.claude-plugin/marketplace.json` for Claude and
`codex/.agents/plugins/marketplace.json` for native Codex variants rather than assuming a fixed list of names.

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

Native Codex variants live under `codex/` in the `gordon-codex-skills` marketplace. Clone the repository,
add that marketplace directory, then install whichever sets you want:

```bash
git clone https://github.com/GordonBeeming/skills.git
codex plugin marketplace add ./skills/codex

codex plugin add <set>@gordon-codex-skills
```

`codex plugin add` copies the set into Codex's own plugin cache — after this repo publishes an update, run
`git pull` and re-run `codex plugin add <set>@gordon-codex-skills` to pick it up.

## Attribution

Some skills here are vendored from other people's repos rather than written from scratch. See
`ATTRIBUTION.md` for the full list of sources and licenses.
