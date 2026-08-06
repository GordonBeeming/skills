---
name: github-upload-file
description: >
  Upload a local image or file to GitHub from the CLI so it can be embedded in an
  issue, PR body, or comment. Use when a bug report or PR needs a screenshot or
  attachment and the content was created locally (gh has no attachments API).
  Works via a dedicated "assets" release on the target repo.
---

# Upload image/file to GitHub

`gh issue create` and `gh pr create` can't attach images — GitHub's drag-and-drop
attachment endpoint has no public API. The reliable CLI path is a dedicated
release that acts as an asset bucket: upload the file as a release asset, embed
the download URL.

## One-time repo setup

Check whether the repo already has the bucket:

```bash
gh release view assets --repo <owner>/<repo>
```

If it doesn't exist, create it — **check the workflows first**:

1. `grep -rn "release" .github/workflows/*.yml` — if any workflow triggers on
   `release: types: [published]`, publishing the bucket will fire it **once**.
   Usually that's one wasted/red run and never again (asset uploads don't fire
   release events). Mention it to User; on repos where a release run has real
   side effects (deploys, notarization), get a nod before publishing.
2. Create it as a published prerelease. A draft won't work — draft assets aren't
   publicly downloadable, so images embedded from one render broken for everyone
   else.

```bash
gh release create assets --repo <owner>/<repo> --target main --prerelease \
  --title "Issue attachments (not a product release)" \
  --notes "Asset bucket for images embedded in issues and PRs. Upload with: gh release upload assets <file>. Not an app release — ignore."
```

## Upload and embed

```bash
gh release upload assets <file.png> --repo <owner>/<repo>
```

The public URL is:

```
https://github.com/<owner>/<repo>/releases/download/assets/<file.png>
```

Embed it with normal markdown: `![alt text](<url>)`. Verify before posting —
`curl -sIL <url> | grep ^HTTP` should end in 200.

## Gotchas

- Asset names must be unique within the release; give files descriptive names
  (`jsonc-comment-highlighting.png`, not `screenshot.png`). `--clobber` replaces
  an existing asset of the same name.
- Private repos: the URL needs repo access, which is fine for embedding in that
  repo's own issues (viewers have access by definition) but the link won't work
  outside it.
- Never delete or repurpose the `assets` release once URLs point at it, and
  never use a product version tag (like `v0.7`) as the bucket.
- Don't reach for a git branch as the bucket instead — a branch shows up in
  clones/branch lists and someone will eventually delete it, killing the URLs
  (that exact thing happened the first time this was tried).

First set up on `user/ide` (2026-07-11), used for issue #55.
