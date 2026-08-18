# Agent Note: Moriarty REST capability seam

Status: implemented

English | [中文](2026-08-18-moriarty-api-capability-seam.zh.md)

## Problem

Moriarty must talk to the existing moriarty-be SaaS (`api.themoriarty.app`) from the first cabinet session: list the user's organizations and client businesses, read capsule files, load the latest aide diagnostic, and search the France-aides catalogue.

The model-facing API must stay stable while the HTTP client, auth, and later a second backend change. Putting those reads directly in `dsh-tool-moriarty` would make the tool own provider selection, bearer resolution, redirect policy, JSON parsing, prompt guidance, and presentation at once. Inventing a `/v1/agent` route on moriarty-be would couple the harness to a backend that does not exist.

OIDC PKCE for a Keycloak public client `moriarty-harness` is not ready. Day-one auth is a user JWT in `MORIARTY_ACCESS_TOKEN`. Putting the seam into `dsh-base` would mount unused Moriarty plugins on every coding-agent profile.

## Decision

Moriarty REST is a first-class capability seam following [the capability-seam Agent Note](2026-06-13-capability-seams.md):

1. `@deepseek-ai/dsh-moriarty-api` (`packages/moriarty/moriarty-api`) owns `ctx.moriarty`, provider registration, provider selection, portable records, and Moriarty-specific errors.
2. `@deepseek-ai/dsh-moriarty-api-http` (`packages/moriarty/moriarty-api-http`) implements the moriarty-be HTTPS backend and registers with `ctx.moriarty`.
3. `@deepseek-ai/dsh-tool-moriarty` (`packages/moriarty/tool-moriarty`) owns the model-facing `moriarty_*` tool schemas, prompt sections, argument validation, result formatting, and presentation over `ctx.moriarty`.

Providers do not register tools. `dsh-tool-moriarty` is the only owner of model-facing names, descriptions, prompt guidance, JSON schemas, and presentation.

The `dsh-moriarty` bundle inserts the service and HTTP provider on the host plane. The `moriarty` agent preset registers the tools. The web profile does not mount this seam; selecting the Cabinet EC preset without the Moriarty bundle fails loudly on `inject: ['moriarty']`.

Selection matches `ctx.web`: a configured provider id (`provider` / `$MORIARTY_API_PROVIDER`), or auto-select when exactly one usable provider is registered. Tools stay visible when the product enabled them; a missing token or provider fails at execution with a structured `MoriartyError`.

HTTP 404 on `GET .../diagnostics/latest` is `null` (no run yet). Other 404s throw `MORIARTY_NOT_FOUND`. Credential-bearing requests use `redirect: 'error'`. The bearer is the user JWT, never `ADMIN_API_KEY`. This seam does not invent `/v1/agent`.

Day-one auth is `MORIARTY_ACCESS_TOKEN` through `ctx.credentials`, with a launch-environment fallback when that service is absent. OIDC PKCE stays deferred.

## Package topology

```text
@deepseek-ai/dsh-tool-moriarty  --depends on-->  @deepseek-ai/dsh-moriarty-api  <--depends on--  @deepseek-ai/dsh-moriarty-api-http
        consumer                                      interface                                  implementation
```

`@deepseek-ai/dsh-moriarty-api` depends only on Cordis, schemastery, branded ids, and `HarnessError`. Provider packages depend only on the seam, credentials, and launch-environment. `@deepseek-ai/dsh-tool-moriarty` never imports the HTTP provider.

## Alternatives considered

### Combine all three roles in one package

Rejected. The web, bash, and filesystem seams already prove that mixing selection, HTTP, and tool schemas makes the next backend or the next model-facing name a cross-cutting edit. Moriarty is the same three-role split.

### Ship OIDC PKCE in this change

Rejected. There is no Keycloak public client `moriarty-harness` yet, and a static bearer is enough to prove the HTTP mapping. Putting PKCE in the same change would block the REST tools on an identity project that is still open.

### Invent `/v1/agent` on moriarty-be

Rejected. The harness consumes the OpenAPI the backend already publishes. A new agent route is a backend product decision, not a harness workaround.

### Mount the seam in `dsh-base`

Rejected. Every coding-agent profile would load unused Moriarty plugins and require a token the operator does not have. The overlay bundle is the product boundary.

## Consequences

**Tool success is not engagement success.** Catalogue hits and HTTP 200 reads still need later verifiers and `justification/*` events; this seam only makes the REST reads callable.

**The Cabinet EC preset needs the Moriarty profile (or an equivalent host row).** On a web-only composition the preset's `inject: ['moriarty']` fails at mount rather than showing a tool that cannot run.

**A missing token fails at the next call, not at load.** That matches web search: the schema stays stable while credentials rotate.

**Assembled snapshot coverage for these tools is the keyless ACP scenario `moriarty-revue-de-portefeuille`.** Package tests and the web-preset catalog e2e prove registration and HTTP mapping; the scenario re-executes the real HTTP GETs and the workspace write. The playbook decision lives in the [revue de portefeuille Agent Note](../feature/2026-08-18-moriarty-revue-de-portefeuille.md).
