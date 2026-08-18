# @deepseek-ai/dsh-moriarty-api

English | [中文](README.zh.md)

The **`MoriartyRuntime`** (`ctx.moriarty`) defines WHAT Moriarty REST reads the harness has — organizations, businesses, capsule files, diagnostics, France-aides catalogue — over multiple providers, without binding the model contract to moriarty-be's Spring DTO graph.

This package owns the Service Definition role of the Moriarty REST capability:

| Package | Role |
|---|---|
| `@deepseek-ai/dsh-moriarty-api` (this) | Service Definition: the service, provider registry, selection policy, request/result records, the `MoriartyError` taxonomy |
| `@deepseek-ai/dsh-moriarty-api-http` | Provider: HTTPS client for `api.themoriarty.app` |
| `@deepseek-ai/dsh-tool-moriarty` | Consumer: the model-facing `moriarty_*` tool schemas over `ctx.moriarty` |

Providers register **capabilities**, not tools. `dsh-tool-moriarty` is the only owner of model-facing names, descriptions, prompt guidance, JSON schemas, and presentation.

## Service API (`ctx.moriarty`)

| Member | Semantics |
|---|---|
| `registerProvider(provider)` | Register a backend. Throws `MoriartyError` `MORIARTY_DUPLICATE_PROVIDER` on a duplicate id. Returns a disposer. Disposed with the calling fiber. |
| `listOrganizations(signal?)` | `GET /v1/organizations/me`. |
| `listBusinesses(request, signal?)` | `GET /v1/businesses/{organizationId}/list`. |
| `getBusiness(request, signal?)` | `GET /v1/businesses/{organizationId}/{businessId}`. |
| `getLatestDiagnostic(request, signal?)` | `GET .../diagnostics/latest`. HTTP 404 is `null` (no run yet), not a throw. |
| `listCapsuleFiles(request, signal?)` | `GET /v1/capsule/{organizationId}/{businessId}/files`. |
| `searchFranceAides(request, signal?)` | `GET /v1/france-aides`. A catalogue hit is not a client eligibility verdict. |

## Selection

Selection never depends on registration, config, or HMR order. A capability has an explicit provider id (config `provider`, or env `$MORIARTY_API_PROVIDER` feeding the same field), or auto-selects when exactly one usable provider is registered. Each method resolves the provider at execution time:

| Situation | Execution |
|---|---|
| configured id registered and `available()` | runs that provider |
| configured id not registered | `MORIARTY_PROVIDER_CONFIGURED_MISSING` |
| configured id registered but unavailable | `MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE` |
| no id, exactly one registered usable provider | runs it |
| no id, no usable provider | `MORIARTY_PROVIDER_UNAVAILABLE` |
| no id, multiple usable providers | `MORIARTY_PROVIDER_AMBIGUOUS` |

A provider's `available()` is a cheap local check and **must not make network calls**. `dsh-tool-moriarty` never calls it — the tool executes through `ctx.moriarty` and routes on the thrown codes.

## Model Experience

Indirectly, through `dsh-tool-moriarty`, which retains endpoint-cited REST records or the exact configured-provider, unavailable-provider, no-provider, multiple-provider, and `Error: <message>` failures while this registry contributes no prompt or schema itself.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **No observation surface** — availability is observed only by executing a method and routing the thrown `MoriartyError` codes.
- **OIDC PKCE is not in this package** — day-one auth is a bearer in `MORIARTY_ACCESS_TOKEN`; the HTTP provider owns resolution.
- **This seam does not invent `/v1/agent`** — it maps only endpoints that moriarty-be already publishes.
