---
name: azure
description: Set the right Azure subscription and tenant for the current repo before any az or Azure MCP call, and run App Insights / Log Analytics queries the way that actually returns rows. Use when the task mentions Azure, az, a subscription, App Insights, Log Analytics, Kusto/KQL, container apps, or "the logs" for a client app. Reads the org's profile for the subscription map; asks when the profile has none.
---

# azure

## Which subscription

1. Resolve the profile: `"${CLAUDE_PLUGIN_ROOT}/scripts/profile.sh" --get azure`. It returns `tenant`, `default`, `environments{name: {subscription, subscriptionId, ...}}`, and `prodGuard`.
2. Pick the environment: the task's words (uat, staging, prod) win; otherwise `azure.default`. If the profile has no `environments`, ask with one question listing what you'd need (subscription id, tenant) and stop until answered. Don't guess a subscription.
3. Check and switch:

```bash
az account show --query '{sub:name, tenant:tenantId}' -o json
az account set --subscription <subscriptionId>          # only if it differs
az login --tenant <tenant>                              # only if the tenant differs; tell User it will prompt
```

4. Only then call Azure MCP tools or `az`.

Rules that don't change per profile:

- Anything matching `azure.prodGuard` is read-only unless User says otherwise in this session. Say which resource tripped the guard.
- Never `az logout` or change global CLI state beyond `az account set` without asking.
- Prefer `az account set` over environment variables so the shell keeps the context.

## Logs that return rows

For App Insights backed by a Log Analytics workspace, query the workspace, not the component: MCP `monitor_workspace_log_query` against the workspace named in `environments.<env>.resources.logAnalytics`, table `AppTraces` (not `traces`). The component route has returned empty for known-good queries.

```kusto
AppTraces
| where TimeGenerated between (datetime(<startZ>) .. datetime(<endZ>))
| where Message has '<id>' or Message has '<HandlerClassName>'
| project TimeGenerated, SeverityLevel, Message, Properties
| order by TimeGenerated asc
```

Resource names per environment live in the profile under `resources`; if a name isn't there, look it up with `az resource list -g <resourceGroup>` and say what you found rather than guessing.
