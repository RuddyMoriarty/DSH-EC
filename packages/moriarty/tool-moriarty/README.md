# @deepseek-ai/dsh-tool-moriarty

English | [中文](README.zh.md)

The model-facing Moriarty REST tool suite over the [Moriarty REST capability](../moriarty-api/README.md) (`ctx.moriarty`). It owns model-facing concerns only: tool names, JSON schemas, prompt sections, result formatting, and the UI presentation projection (`presentCall` as a generic search card). All REST access goes through `ctx.moriarty`; this package never imports a concrete provider. No tool exposes a model-facing timeout — each tool's cooperative tool-call budget is declared here via config (`timeoutMs`, attached as `ToolDefinition.timeoutMs`) and enforced by [`@deepseek-ai/dsh-tool-call-timeout-policy`](../../guard/timeout-policy/README.md); each tool just forwards `exec.signal` to the seam.

Tools stay registered when the product enabled them and `ctx.moriarty` is present. Backend availability is an execution-time concern: a missing token or provider fails the call with a structured `MoriartyError`.

## Tools

| Tool | Args | Behavior |
|---|---|---|
| `moriarty_list_organizations` | (none) | Lists organizations for the current token. Source: `GET /v1/organizations/me`. |
| `moriarty_list_businesses` | `organizationId`, optional `page`/`size`/`search` | Lists client businesses. Source: `GET /v1/businesses/{organizationId}/list`. |
| `moriarty_get_business` | `organizationId`, `businessId` | Loads one business. Source: `GET /v1/businesses/{organizationId}/{businessId}`. |
| `moriarty_get_latest_diagnostic` | `organizationId`, `businessId` | Latest diagnostic, or reports that none exists. Source: `GET .../diagnostics/latest`. |
| `moriarty_list_capsule_files` | `organizationId`, `businessId`, optional `page`/`size` | Lists capsule files. Source: `GET /v1/capsule/{organizationId}/{businessId}/files`. |
| `moriarty_search_france_aides` | optional `search`/`page`/`size` | Searches the France-aides catalogue. A hit is not a client eligibility verdict. Source: `GET /v1/france-aides`. |

Every tool opts into concurrent scheduling because these reads do not mutate parent-agent state. Every successful render cites the owning endpoint.

## Config

| Key | Default | Meaning |
|---|---|---|
| `timeoutMs` | `30000` | Cooperative tool-call timeout budget (ms) for every Moriarty tool. |

```yaml
- id: tool-moriarty
  name: '@deepseek-ai/dsh-tool-moriarty'
```

## Model Experience

### System prompt

#### What the model sees

The tools contribute the cabinet REST guidance below. A scoped tool restriction does not remove this independently registered section.

##### Moriarty REST guidance

```markdown
Use the Moriarty REST tools for the current cabinet organization, its businesses, capsule files, diagnostics, and the France-aides catalogue. Cite the tool and endpoint in every figure or eligibility claim. A successful tool call is not a completed engagement. A France-aides catalogue hit is not a client eligibility verdict.
```

#### Token effect

Fixed guidance cost per request, even when a restriction hides a schema.

#### KV Cache effect

Prefix-stable while the plugin is mounted and the guidance text is unchanged. Plugin lifecycle may invalidate reuse from the first changed prompt section; scoped schema restrictions do not remove it.

### Tool schemas

#### What the model sees

The model sees the generated [`moriarty_*` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-moriarty). Timeout budgets are deployment settings, not model arguments.

#### Token effect

Fixed schema cost per request; a scoped restriction removes only the schema.

#### KV Cache effect

Prefix-stable while definitions and visibility are unchanged. Plugin lifecycle or scoped restrictions may invalidate reuse from the first changed schema token.

### REST result

#### What the model sees

A successful call is a markdown list or one-line summary followed by `Source: GET <endpoint>`. Empty pages say no organizations/businesses/files/aides/diagnostic. France-aides results always add `A catalogue hit is not a client eligibility verdict.` Failures become `Error: <message>`.

#### Token effect

Data-dependent results are resent until compaction.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Argument errors

#### What the model sees

Blank ids become exactly `Error: organizationId must be a non-empty string` or `Error: businessId must be a non-empty string`.

#### Token effect

Only the failing call adds these retained tokens.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

- **Write operations are out of scope** — capsule upload and eligibility claims wait on a later consumer and human-review policy.
- **No Moriarty-specific permission policy** — tools execute without requesting `ctx.approval`; a deployment that needs confirmation must add a `tools/pre-execute` policy.
