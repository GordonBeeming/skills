---
name: github-upload-file
description: >
  Put a local image or video into a GitHub issue, PR body, or comment from the CLI with
  `gh --attach`. Use when a bug report, PR, or comment needs a screenshot, a before/after pair, or
  a recording that was made locally. Never ask User to drag files in and never upload through a
  browser. Not for non-media files (logs, PDFs): see `references/release-bucket.md`.
---

# Attach image/file to GitHub

`gh` attaches images and videos itself (gh 2.99 and later): `--attach <path>` on `gh issue create`,
`gh issue edit`, `gh issue comment`, `gh pr create`, `gh pr edit`, and `gh pr comment`. The file is
uploaded to GitHub's own attachment store, the same place a drag-and-drop lands, and needs push
access to the repo. Every image gathered for the issue or PR is attached, unless User says to
leave one out; the ones that look redundant while writing are the ones that settle a question later.

## Placing the image

Reference the file in the body first, then attach it; `gh` rewrites the reference in place to the
uploaded URL. Paths in the body and on the flag are absolute, so the worktree check and the body's
location never matter:

```markdown
| Before | After |
|---|---|
| ![before: fund list](/Users/user/.claude/runs/<run>/evidence/before-fund-list.png) | ![after: fund list](/Users/user/.claude/runs/<run>/evidence/after-fund-list.png) |
```

```bash
gh pr create --base main --head <branch> --title "<title>" --body-file <abs>/pr-body.md --draft \
  --attach /Users/user/.claude/runs/<run>/evidence/before-fund-list.png \
  --attach /Users/user/.claude/runs/<run>/evidence/after-fund-list.png
```

Rules the flag enforces:

- One `--attach` per file; the same file cannot be attached twice. A file the body does not
  reference is appended at the end in flag order, so reference every file you want placed.
- Alt text: from the markdown when the body references the file; otherwise
  `--attach '<path>#<alt text>'`, else the file name. Video takes no alt text.
- A video plays inline only when `![](<path>)` is the whole paragraph; inside a sentence it renders
  as a link. Put a still (a one-frame poster) beside it when the viewer should see something
  without pressing play.
- `gh pr edit <n> --attach <path>` with no body flag keeps the body and appends the file; with
  `--body-file` it rewrites the references like `create` does.
- Supported: PNG, JPEG, GIF, WebP, SVG, MP4, MOV, WebM. Anything else (a log, a PDF, a zip) is not
  an attachment; `references/release-bucket.md` has the release-asset fallback for those.

## Check

`gh pr view <n> --json body --jq .body | grep -c 'user-attachments'` equals the number of files
attached. A body that still contains a local path means that file was not attached; run
`gh pr edit <n> --body-file <abs>/pr-body.md --attach <path>` for the missing one.
