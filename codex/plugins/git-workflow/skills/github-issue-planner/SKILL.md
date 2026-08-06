---
name: github-issue-planner
description: "Plan implementation for a GitHub issue. Use this skill whenever the user pastes a GitHub issue URL (e.g., https://github.com/org/repo/issues/123), mentions a GitHub issue number in the context of a repo, or asks to plan work for a bug, PBI, or feature tracked in GitHub Issues. Also trigger when the user says things like 'plan this issue', 'look at this bug', or provides a GitHub link with minimal other instructions — the intent is almost always 'fetch the issue, understand the codebase, and give me a plan'. Even a bare URL with no other text should trigger this skill."
---

# GitHub Issue Planner

You help developers go from a GitHub issue URL to a concrete implementation plan with minimal effort. The user shouldn't need to explain much — just give you the link and optionally some guidance.

## Workflow

### 1. Parse the input

Extract the GitHub issue URL from the user's message. The URL typically looks like:
- `https://github.com/{owner}/{repo}/issues/{number}`
- The user might also just say "issue #123" if you're already in the right repo

If the user provided additional context or guidance alongside the URL (e.g., "I think this is in the auth module" or "we should use approach X"), note it — you'll incorporate it into the plan.

### 2. Fetch the issue

Use `gh` CLI to get the full issue details:

```bash
gh issue view {number} --repo {owner}/{repo} --json title,body,comments,labels,assignees,milestone,state
```

Read through the issue title, description, comments, and labels. Comments often contain important context, decisions, or constraints that aren't in the original description.

If the issue references other issues or PRs, fetch those too — they often contain related context. Look for patterns like `#123`, `fixes #456`, or full GitHub URLs in the body and comments.

### 3. Understand the codebase

Now explore the **current session's repository** (the working directory, not the issue's repo — though they're often the same). The goal is to find the code areas relevant to this issue.

Use a systematic approach:
- Start with keywords from the issue (error messages, feature names, component names)
- Search for relevant files, classes, and functions
- Read key files to understand the current implementation
- Look at recent related changes via git log if helpful
- Check for existing tests, configuration, or documentation related to the area

Spend enough time here to actually understand the relevant code. A plan built on assumptions about code you haven't read is worse than no plan at all.

### 4. Create the implementation plan

Produce a clear, actionable plan. Structure it based on what fits the issue — don't force a rigid template. But generally include:

**Context** — A brief summary of the issue and what you learned from the codebase. This anchors the plan so someone reading it later understands the starting point.

**Approach** — The high-level strategy. If there are multiple viable approaches, briefly mention the alternatives and why you're recommending this one.

**Implementation steps** — Concrete, ordered steps. For each step:
- Which files to create or modify (with paths)
- What the change involves
- Any gotchas or things to watch out for

**Testing** — What needs to be tested and how. Reference existing test patterns in the repo.

**Risks / Open questions** — Anything uncertain, any assumptions you're making, any questions that should be answered before starting.

### 5. Enter plan mode

After drafting the plan, enter plan mode so the user can review, discuss, and refine it before any implementation begins. The plan is a conversation — the user might want to adjust the approach, add constraints, or ask questions.

## Guidelines

- **Be thorough but concise.** Read enough code to be confident in your plan, but don't dump every file you read into the output. The plan should be actionable, not a research report.
- **Incorporate user guidance.** If the user gave hints about approach, area of code, or constraints, weave those into the plan rather than ignoring them.
- **Don't start implementing.** This skill is about planning, not coding. Produce the plan and wait for the user to approve or adjust before writing any code.
- **Match the repo's patterns.** If the codebase uses a particular architecture, naming convention, or test framework, the plan should follow those patterns. Don't suggest introducing new patterns unless the issue specifically calls for it.
- **Cross-repo issues.** If the issue is in a different repo than the current working directory, note this clearly. You can still plan against the current repo's code, but flag any assumptions about how the repos relate.
