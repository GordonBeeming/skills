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
3. "Which review event?" The pattern decides it, and the question only confirms:
   - a Blocker or High is being posted: `request changes`
   - only Medium or Low, or nothing: `approve`
   - `comment` only when User asks for it.

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
  edit goes in a ```suggestion block so the author can apply it. No severity label in the text, no
  finding ids, no tool names: the severity lives in `findings.json` and in the chat summary, not in
  what the author reads.

## The review body

One line, from a fixed pattern. No examples to imitate, no other prose.

- A Blocker or High is posted: **request changes**.
  `Requesting changes: <n> High, <n> Medium, <n> Low. Once the Highs are fixed, happy for someone else to approve.`
- Only Medium or Low is posted: **approve**.
  `Approving: <n> Medium, <n> Low. They can be fixed after, no need to hold this.`
- Nothing is posted: **approve**, body `Approving.`

Leave out any level with a count of zero. Say "Blockers" in place of "Highs" when the worst posted
finding is a Blocker. Nothing else goes in the body: no process narration, no ranking, no caveats.
The inline comments carry the detail.

Inline comments: say what is wrong and what to do, in a sentence, the way you would say it at
someone's desk. No severity label in the text, no restating the code back at the author. A
suggestion block instead of describing the edit, when the fix is small.

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
