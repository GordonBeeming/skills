# skills

This is a curated selection of my Claude Code and Codex skills, published once they're stable enough to share.

It's just a copy of what I actually use, no song and dance. I'm sharing it in case anyone wants to reference
it or pull bits of it into their own setup.

A "set" is a themed group of skills you install together (one for iOS work, one for git/PR workflows, and so
on). Sets appear here as skills get published, so check `.claude-plugin/marketplace.json` for Claude and
`.agents/plugins/marketplace.json` for Codex rather than assuming a fixed list of names.

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

The `gordon-codex-skills` marketplace is registered from the repository root. Clone the repo, add it, then
install whichever sets you want:

```bash
git clone https://github.com/GordonBeeming/skills.git
codex plugin marketplace add ./skills

codex plugin add <set>@gordon-codex-skills
```

Sets under `codex/` are Codex-native rewrites of their Claude counterparts. Sets under `generic/` are
client-agnostic and install from this same marketplace, so they aren't duplicated per client.

`codex plugin add` copies the set into Codex's own plugin cache, so after this repo publishes an update, run
`git pull` and re-run `codex plugin add <set>@gordon-codex-skills` to pick it up.

If you added the marketplace before as `./skills/codex`, re-add it as `./skills` — the manifest moved to the
repository root so Codex can reach the `generic/` sets.

## Attribution

Some skills here are vendored from other people's repos rather than written from scratch. See
`ATTRIBUTION.md` for the full list of sources and licenses.
