---
name: skillspector-scan
description: Scan an AI agent skill for security vulnerabilities with the `skillspector` CLI, using the Anthropic provider (key pulled from 1Password). Only invoke when the user explicitly types /skillspector-scan — never trigger on a general request to "scan", "audit", or "check" a skill, because each run spends real Anthropic API money. Accepts a path, Git URL, zip, .md file, or directory and returns the scanner's report.
---

# Skill: skillspector-scan

## Purpose

Run `skillspector scan` against a skill and hand the report back to the user. SkillSpector is a security scanner for AI agent skills — it flags risky trigger phrases, data-access disclosure gaps, silent file deletes, unguarded installs, executable scripts, etc.

This skill wires it to the **Anthropic** LLM provider with the API key injected from 1Password at runtime — the key is never written to disk or printed.

**Explicit-invocation only.** Every run spends real Anthropic API money, so only run this when the user types `/skillspector-scan`. Don't fire it off a general "scan/audit this skill" intent, and don't run it proactively as part of some other task.

## Invocation

```
/skillspector-scan [target]
```

`target` is what to scan. It accepts any input the CLI accepts:

- Git URL — `https://github.com/blader/humanizer`
- a local directory or `.md` file path
- a `file://` URL or a `.zip`

If `target` is missing, ask for it with `request_user_input` when available, or directly otherwise — never guess one.

## Steps

1. **Resolve the target.** Use whatever the user passed verbatim. The CLI clones Git URLs itself, so no manual download/clone step is needed — pass the URL straight through.

2. **Run the scan**, injecting the Anthropic key from 1Password via `op run` (so the secret stays out of the shell history and logs):

   ```bash
   ANTHROPIC_API_KEY="op://ai-secrets/Anthropic API key - DONT JUST USE/password" \
   SKILLSPECTOR_PROVIDER=anthropic \
   op run -- skillspector scan "<target>"
   ```

   - Default output format is `terminal` — keep it; it's the readable report.
   - The LLM pass takes a while (tens of seconds to a couple of minutes for a multi-file skill). Use a generous timeout (~300s).
   - For a directory holding several skills, add `--recursive`.

3. **Return the result.** Show the scanner's output to the user — risk score, the issues list, and the script-execution note. Don't re-summarise or editorialise on this first pass; the user wants to see the raw report. (They may follow up asking for a nicer formatted version — wait for that.)

## Notes

- Key reference: `op://ai-secrets/Anthropic API key - DONT JUST USE/password`. Run `op whoami` first. If it fails, stop and ask User; never run or recommend an automatic `op signin` fallback.
- `--no-llm` exists for a fast static-only pass. Only use it if the user explicitly asks for a quick/offline scan or the Anthropic key is unavailable; flag clearly when you do, since it's less accurate.
- Other useful flags: `--format json|markdown|sarif -o <file>` to save a machine-readable report, `--verbose` for progress detail, `--baseline <file>` to suppress known findings.
