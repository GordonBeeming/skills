# Release-asset bucket (non-media files only)

`gh --attach` takes images and video only. A log, a PDF, a zip, or any other file that has to be
linked from an issue or PR goes through a dedicated release that acts as an asset bucket: upload
the file as a release asset, link the download URL. Never use this for an image; attach those.

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

Embed it with normal markdown: `![alt text](<url>)`. Verify before posting, via
`gh` rather than the URL:

```bash
gh release view assets --repo <owner>/<repo> --json assets -q '.assets[].name' | grep -Fxq -- "<file>"
```

On a **private** repo an unauthenticated `curl -sIL <url>` returns 404 for an
asset that uploaded fine and embeds fine, so a curl check reports a failure that
isn't there. The `gh` listing is authenticated and works either way.

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
