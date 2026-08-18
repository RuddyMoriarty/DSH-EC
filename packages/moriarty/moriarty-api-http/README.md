# @deepseek-ai/dsh-moriarty-api-http

English | [中文](README.zh.md)

An HTTPS `MoriartyApiProvider` for the harness [Moriarty REST capability](../moriarty-api/README.md) (`ctx.moriarty`). It calls moriarty-be with a bearer token and maps JSON bodies into the seam's portable records.

This is an **implementation** package: it registers a provider into `ctx.moriarty`, it does not own the `ctx.moriarty` key and it does not register a model-facing tool (that is `@deepseek-ai/dsh-tool-moriarty`). Like `@deepseek-ai/dsh-web-search-exa`, it is a function/namespace plugin (`inject: ['moriarty']`).

## Config

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | `$MORIARTY_API_BASE_URL` or `https://api.themoriarty.app` | API origin, no trailing slash. An unparseable value makes the provider unavailable. |
| `accessTokenEnv` | `MORIARTY_ACCESS_TOKEN` | Credential reference resolved per request through `ctx.credentials`, or from the launch environment when that seam is absent. Empty/absent fails the call as `MORIARTY_AUTH_MISSING`. |
| `timeoutMs` | `30000` | Resource-backstop timeout. Must be a positive integer no greater than Node's timer delay cap. |

```yaml
- id: moriarty-api-http
  name: '@deepseek-ai/dsh-moriarty-api-http'
  config:
    baseURL: !!js process.env.MORIARTY_API_BASE_URL || 'https://api.themoriarty.app'
    accessTokenEnv: MORIARTY_ACCESS_TOKEN
```

## Mapping

| Method | HTTP |
|---|---|
| `listOrganizations` | `GET /v1/organizations/me` |
| `listBusinesses` | `GET /v1/businesses/{organizationId}/list` |
| `getBusiness` | `GET /v1/businesses/{organizationId}/{businessId}` |
| `getLatestDiagnostic` | `GET .../diagnostics/latest` — HTTP 404 → `null` |
| `listCapsuleFiles` | `GET /v1/capsule/{organizationId}/{businessId}/files` |
| `searchFranceAides` | `GET /v1/france-aides` |

HTTP redirects are rejected before the `Location` target is contacted (`redirect: 'error'`) and surface as `MORIARTY_REDIRECT_REFUSED`. HTTP 401 is `MORIARTY_AUTH_MISSING`; 403 is `MORIARTY_FORBIDDEN`; other non-diagnostic 404s are `MORIARTY_NOT_FOUND`. Aborted requests surface as `MORIARTY_ABORTED`. The bearer is a user JWT (`MORIARTY_ACCESS_TOKEN`), never `ADMIN_API_KEY`.

## Model Experience

Indirectly, through [`dsh-tool-moriarty`](../tool-moriarty/README.md), which retains this provider's endpoint-cited records or its exact missing-token, forbidden, not-found, aborted, redirect-refused, and unprocessable-body failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **OIDC PKCE is deferred** — day-one auth is a static bearer in `MORIARTY_ACCESS_TOKEN`; there is no Keycloak public client `moriarty-harness` yet.
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError` maps to `MORIARTY_ABORTED`.
- **This provider does not invent `/v1/agent`** — writes (capsule upload, eligibility claims) wait on a later consumer.
