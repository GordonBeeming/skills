# Posting a review

Nothing reaches GitHub during a review. Findings are gathered, ranked, and reported in chat first;
then User is asked, in this order, whether to post at all, which levels, and which event. One
review carries every comment, the way a human clicks Start a review, comments on each hunk, and
finishes with Approve, Comment, or Request changes. Never loose comments posted one at a time, and
never a PR-level comment where a line comment belongs.

## The three questions, after the summary

Asked one at a time, each skipped when its flag is on the command. Never asked before the summary.

1. "Post this review to GitHub?" `yes` / `no`. Flag: `--post <levels>` or `--post none`.
2. "Which levels?" multi-select over the levels this review actually produced, with counts, for
   example `Blocker (0)`, `High (1)`, `Medium (5)`, `Low (3)`. Defaults ticked: everything at Medium
   and above. Unticked levels stay in the chat summary and the artifact, and never reach GitHub.
   Flag: `--post high,medium`.
3. "Which review event?" `approve`, `comment`, `request changes`, with the run's recommendation as
   the first option and one line saying why. The recommendation is:
   - a Blocker or High in the ticked levels: `request changes`
   - Medium only: `comment`
   - nothing ticked, or Lows only, and the verdict is approve: `approve`
   Flag: `--event approve|comment|request-changes`.

User's answer wins over any recommendation. `approve` with a Blocker or High ticked is allowed
only after one confirming question naming the finding.

## The payload

One call, `event` from question 3, `comments` from the ticked findings:

```bash
jq -n --arg body "$(cat <run dir>/review-body.md)" \
      --slurpfile c <run dir>/review-comments.json \
      '{body:$body, event:"REQUEST_CHANGES", comments:$c[0]}' > <run dir>/review-post.json
gh api repos/<o>/<r>/pulls/<n>/reviews --input <run dir>/review-post.json --jq '.html_url'
```

`review-comments.json` is an array, one object per posted finding:

```json
[ { "path": "src/Hub.Api/Endpoints/Foo.cs", "line": 42, "side": "RIGHT", "body": "..." },
  { "path": "src/Hub.Api/Endpoints/Bar.cs", "start_line": 10, "line": 14, "side": "RIGHT", "body": "..." } ]
```

- `line` is the line number in the file **as the diff leaves it**, not a diff position. `side`
  is `RIGHT` for added or unchanged lines, `LEFT` for a line the PR deletes.
- A finding about a block gets `start_line` plus `line` so the comment spans the hunk.
- Every comment must sit on a line the diff touches. A finding about code the PR did not change
  goes in the review body under "Not in this diff", with its file and line in the text.
- Comment body: what is wrong, the consequence, and the fix in one or two sentences. A suggested
  edit goes in a ```suggestion block so the author can apply it. Level in bold at the front:
  `**High** — ...`. No finding ids, no tool names, no "as an AI".

## The review body

Written as User, first person, no agent named. Three parts: one line of verdict and what was
reviewed; the counts posted per level; then any finding that could not be anchored to a line, and
the levels that were left out ("3 Lows are in my notes, ask if you want them"). Never the whole
findings list repeated.

## Failures

- `422 Unprocessable Entity` on a comment: its line is outside the diff. Drop that comment into the
  body's "Not in this diff" list and post again. Never retry the same payload.
- A second review on the same head is allowed only when User asks for it after new commits.
- `gh pr review --approve` is for an approval with no inline comments. With comments, always the
  reviews API call above, so every comment lands inside the one review.

## Boundaries

Never merge, never dismiss another reviewer's review, never resolve another reviewer's thread, never
approve over an unresolved thread of User's own. On a branch with no PR: nothing is posted and the
report says `skipped (no PR)`.
