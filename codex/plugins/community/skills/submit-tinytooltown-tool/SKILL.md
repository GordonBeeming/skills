---
name: submit-tinytooltown-tool
description: "Submit a tool to Shane Hanselman's Tiny Tool Town (tinytooltown.com). Use when the user wants to add, submit, or list a tool on Tiny Tool Town, says things like 'submit this to tiny tool town', 'add my tool to tinytooltown', 'TinyToolTown submission', or points at a repo and asks to get it onto Tiny Tool Town. Downloads the live submission template each run, analyzes the tool's repo, shows a plan of the exact issue it will open, and creates it via the gh CLI only after approval."
---

# Submit a tool to Tiny Tool Town

Tiny Tool Town (https://www.tinytooltown.com) accepts free, fun, open-source tools through a GitHub issue form on `shanselman/TinyToolTown`. This skill takes a tool's repo, fills out that form, shows the user exactly what will be submitted, and opens the issue with `gh` once they approve.

The form changes over time, so **always re-download the current template at the start of every run** — never rely on a remembered field list.

## Workflow

### 1. Resolve the target tool repo

The tool being submitted is normally in the **current working directory**. Accept an override if the user points at a different local path or a GitHub URL.

Confirm it's a public GitHub repo and gather metadata in one shot:

```bash
gh repo view {owner}/{repo} --json name,description,url,homepageUrl,repositoryTopics,primaryLanguage,licenseInfo,isPrivate,owner
```

If the repo is private, stop and tell the user — Tiny Tool Town only lists public tools. If the working directory isn't a GitHub repo and no repo was named, ask which repo to submit.

Also read the repo's `README` for the tagline, the longer description, and any screenshot image the site could use as a thumbnail.

### 2. Download the live submission template

Fetch the raw issue form straight from the repo so the field list is always current:

```bash
gh api repos/shanselman/TinyToolTown/contents/.github/ISSUE_TEMPLATE/submit-tool.yml \
  -H "Accept: application/vnd.github.raw"
```

Parse it yourself from the returned YAML — read every `body` entry and note, per field: its `id`, `label`, whether `validations.required` is true, and for the `theme` dropdown its list of `options`. Drive the rest of the skill off what you just parsed, not off this document, so a field added, removed, or made required upstream flows through automatically.

The `type: markdown` blocks (the welcome text) are instructions to the submitter, not fields — skip them when building the body.

### 3. Map the repo onto the fields

Fill each field from the repo. As of this writing the form asks for these; treat the parsed template as the source of truth if it differs:

| Field id | Required | Where it comes from |
| --- | --- | --- |
| `name` | yes | Tool name — the repo/README title |
| `tagline` | yes | One short, fun line for the card |
| `description` | yes | A few sentences: what it does, why it was built, why it's delightful |
| `github_url` | yes | The repo URL |
| `website_url` | no | `homepageUrl`, or a demo link from the README |
| `thumbnail_url` | no | A direct URL to a README screenshot (PNG/JPG/WebP/GIF, ideally ≥960×540). Leave blank to let the site auto-pick from the README |
| `author` | yes | Author display name(s) — `git config user.name`, or the repo owner |
| `author_github` | yes | GitHub username(s) — `gh api user --jq .login`, or the repo owner. Multiple authors: comma-separated, in the same order as `author` |
| `tags` | yes | Comma-separated, from `repositoryTopics` plus anything obvious about the tool |
| `language` | no | `primaryLanguage.name` |
| `license` | no | `licenseInfo.spdxId` |
| `theme` | no | One of the dropdown options, or leave as the default (`None (site default)`) unless the user wants a theme |

**Don't invent required values.** If you can't confidently fill a required field from the repo (usually the tagline or the "why it's delightful" description), draft your best attempt and flag it in the plan so the user can correct it, rather than presenting a guess as final.

### 4. Check the checklist honestly

The form ends with required confirmation checkboxes (currently: free and open source, not enterprise/paid SaaS, public repo and the tool works). Only tick a box you can actually confirm from the repo — an OSI-style license present, no paywall/SaaS signals, the repo public. Surface anything you can't verify so the user decides before submitting; never tick a required box on a guess.

### 5. Build the issue

- **Title:** `[Tool] {name}` (matches the form's `title` prefix).
- **Body:** reproduce how GitHub renders a submitted issue form so it looks native. For each field, in template order:
  - Input/textarea/dropdown → a `### {label}` heading, a blank line, then the value. For a blank optional field, use `_No response_`.
  - The checkboxes field → a `### {label}` heading, then one `- [x] {option label}` line per ticked box (`- [ ]` for any unticked).

Write the body to a temp file (in the scratchpad directory) for `--body-file`, so newlines and markdown survive intact.

### 6. Show the plan and wait for approval

Present the full submission for review **before** creating anything: the resolved target repo, every field value, which checklist boxes are ticked, any fields you had to guess, and the complete rendered body. Use the harness's plan-approval step so nothing is submitted until the user signs off. This is the gate — do not run `gh issue create` before approval.

### 7. Create the issue

On approval:

```bash
gh issue create \
  --repo shanselman/TinyToolTown \
  --title "[Tool] {name}" \
  --body-file {tmp-body-file}
```

Do **not** pass `--label`. The template's `new-tool` label is auto-applied only for web-form submissions, and you won't have triage rights on someone else's repo, so passing it just errors. The maintainers label it during triage.

Report the created issue URL back to the user.

## Notes

- The submission opens against `shanselman/TinyToolTown`, not the tool's own repo — keep those straight.
- Your GitHub username becomes your Tiny Tool Town author page (`tinytooltown.com/authors/{username}/`), so `author_github` matters — get it right.
- This skill never edits the tool's repo. It only reads it and opens one issue.
