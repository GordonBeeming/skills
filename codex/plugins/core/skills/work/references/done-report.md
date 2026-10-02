# Done report

Generated from `run.json`. Every run ends with this, including runs that stopped at a cap or a gate.

## run.json (v1)

```json
{
  "skill": "work", "version": 1,
  "startedAt": "2026-09-09T08:00:00Z", "endedAt": "",
  "caps": { "wallClock": "2h" },
  "source": "https://github.com/org/repo/issues/123",
  "profile": "example-org",
  "worktree": "/path/to/repo/.codex/worktrees/123-shuffle-stages",
  "mode": { "gates": ["plan"], "chosenBy": "question" },
  "workers": {
    "pool": ["codex", "claude"],
    "composition": [
      { "id": "ws-api", "kind": "codex", "model": "luna", "role": "build", "justification": "" }
    ]
  },
  "steps": [
    { "id": "menu",     "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "profile",  "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "source",   "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "research", "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "team",     "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "plan",     "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "build",    "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "verify",   "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "test",     "status": "skipped", "reason": "test.e2e is none", "startedAt": "", "endedAt": "" },
    { "id": "pr",       "status": "done", "reason": "", "startedAt": "", "endedAt": "" },
    { "id": "report",   "status": "done", "reason": "", "startedAt": "", "endedAt": "" }
  ],
  "outputs": { "plan": "", "pr": "", "artifact": "", "report": "" }
}
```

Step ids are fixed: `menu`, `profile`, `source`, `research`, `team`, `plan`, `build`, `verify`,
`test`, `pr`, `report`. `chosenBy` is `question` or `flag`. Status is one of `pending`, `running`,
`done`, `skipped`, `failed`. A `skipped` or `failed` step always has a `reason`.

## The report

```
$work <slug>: <done | stopped at <gate> | stopped (cap: <which>)>
<what shipped, one line>
<what did not, one line, or "Everything in the plan landed.">

menu      done (mode: plan; workers: codex, claude; chosen by question)
profile   done (example-org)
source    done
research  done
team      done (3 rows: ws-api codex/luna, ws-migrate codex/sol, rev-claude claude/sonnet)
plan      done (<run dir>/plan.md; posted to issue: <URL or no>)
build     done (ws-api done, ws-migrate failed: 2 fix rounds, rev-claude done)
verify    done
test      skipped (test.e2e is none)
pr        blocked (waiting: your answers to the 5 template questions)
pr        done (draft, copilot + claude requested, 2 bot rounds, published)
report    done

Outputs
- PR: <URL or none>
- Plan: <path or comment URL>
- Artifact: <file:// URL or none>
- Run dir: <path>
```

Rules:

- Three summary lines, then exactly one line per step in the fixed order, then the outputs block.
- A step line carries only status and the parenthesised facts shown above. No prose after it.
- Nothing else. No recap of the plan, no next steps, no questions. A follow-up that matters is a
  `failed` reason on the step it belongs to.
- Write `endedAt` to `run.json` and set `outputs.report` to the run dir before printing.
