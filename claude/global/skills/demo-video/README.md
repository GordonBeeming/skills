# demo-video

See `SKILL.md` for the workflow.

## Playwright dependency

The scripts (`scripts/cards.mjs`, `scripts/studio.mjs`, `examples/acme-renewals/trigger.mjs`) `require()`
Playwright from a fixed path: `/Users/user/node_modules/playwright`. That resolves because dotfiles
stows a shared `node_modules/` into `~/node_modules/` — see the dotfiles repo's `CLAUDE.md` for why that
directory is intentionally stowed. This only works on User's machine while dotfiles stays stowed; it isn't
portable as-is.
