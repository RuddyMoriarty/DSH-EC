# Moriarty REST

English | [中文](moriarty.zh.md)

The Moriarty REST capability — a [capability seam](../../.agents/notes/implemented/architecture/2026-08-18-moriarty-api-capability-seam.md) on `ctx.moriarty`, split across packages: Service Definition ([dsh-moriarty-api](../../packages/moriarty/moriarty-api), `ctx.moriarty` + the provider registry), Service Provider ([dsh-moriarty-api-http](../../packages/moriarty/moriarty-api-http)), and Consumer ([dsh-tool-moriarty](../../packages/moriarty/tool-moriarty), the `moriarty_*` tool schemas). Moriarty is **one optional product overlay**, not part of the agent-loop spine — so its records live here, not in [core.md](core.md). A provider swap does not change how the model asks for an organization or a France-aides search.

Source: [`packages/moriarty/moriarty-api/src/types.ts`](../../packages/moriarty/moriarty-api/src/types.ts)

Providers register **capabilities**, not tools. The model-facing names, schemas, prompt guidance, and presentation all live in the single `dsh-tool-moriarty` consumer. HTTP 404 on the latest diagnostic is a domain empty (`null`), not a transport failure. A France-aides catalogue hit is not a client eligibility verdict.

```ts type-equiv
/** One organization the authenticated user belongs to. */
interface Organization {
  readonly id: OrganizationId
  readonly name: string
  readonly displayName: string
}
```

```ts type-equiv
/** One client business in an organization. */
interface Business {
  readonly id: BusinessId
  readonly name: string
  readonly organizationId: OrganizationId
  readonly archived: boolean
  readonly tags: readonly string[]
  readonly auditUpdatedAt: string
  readonly siret?: string
  readonly socialReason?: string
}
```

```ts type-equiv
/** Latest aide-eligibility diagnostic summary, or the empty case. */
interface DiagnosticSummary {
  readonly id: string
  readonly businessId: BusinessId
  readonly businessName: string
  readonly status: string
  readonly diagnosticType: string
  readonly startedAt: string
  readonly completedAt?: string
  readonly totalEligible?: number
  readonly errorMessage?: string
}
```

```ts type-equiv
/** One capsule file listing row. */
interface CapsuleFile {
  readonly id: string
  readonly name: string
  readonly contentType: string
  readonly type: string
  readonly version: number
  readonly auditUpdatedAt: string
}
```

```ts type-equiv
/** One France-aides catalogue card (not a client eligibility verdict). */
interface FranceAide {
  readonly id: number
  readonly nom: string
  readonly couvertureGeo: string
  readonly status: number
  readonly objet?: string
}
```

```ts type-equiv
/**
 * A Moriarty REST backend. `id` is unique within this capability.
 * `available()` is a cheap local check and must not make network calls.
 */
interface MoriartyApiProvider {
  readonly id: string
  available(): boolean
  listOrganizations(signal?: AbortSignal): Promise<readonly Organization[]>
  listBusinesses(request: ListBusinessesRequest, signal?: AbortSignal): Promise<BusinessPage>
  getBusiness(request: GetBusinessRequest, signal?: AbortSignal): Promise<Business>
  /**
   * Latest diagnostic for the business. `null` when the API returns HTTP 404
   * (no run yet) — that is a domain empty, not a transport failure.
   */
  getLatestDiagnostic(request: GetBusinessRequest, signal?: AbortSignal): Promise<DiagnosticSummary | null>
  listCapsuleFiles(request: ListCapsuleFilesRequest, signal?: AbortSignal): Promise<CapsuleFilePage>
  searchFranceAides(request: SearchFranceAidesRequest, signal?: AbortSignal): Promise<FranceAidePage>
}
```

## Provider availability

A provider's `available(): boolean` is a cheap LOCAL check (parseable origin, positive timeout) and **must not make network calls**. It is an input to execution-time selection. Selection never depends on registration order: an explicit provider id (config `provider`, or `$MORIARTY_API_PROVIDER` feeding the same field) wins when registered and usable; otherwise exactly one usable provider is required.

## Errors

`MoriartyError extends HarnessError` ([core.md](core.md) error taxonomy) with a `code: string` (open): a provider may raise its own codes without editing `dsh-moriarty-api`. Seam-neutral codes include `MORIARTY_DUPLICATE_PROVIDER`, `MORIARTY_PROVIDER_UNAVAILABLE`, `MORIARTY_PROVIDER_CONFIGURED_MISSING`, `MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE`, `MORIARTY_PROVIDER_AMBIGUOUS`, and `MORIARTY_INVALID_REQUEST`. HTTP-provider codes include `MORIARTY_AUTH_MISSING`, `MORIARTY_FORBIDDEN`, `MORIARTY_NOT_FOUND`, `MORIARTY_ABORTED`, `MORIARTY_REDIRECT_REFUSED`, `MORIARTY_HTTP_ERROR`, and `MORIARTY_INVALID_RESPONSE`.

The HTTP provider sends a user JWT from `MORIARTY_ACCESS_TOKEN`, never `ADMIN_API_KEY`, and refuses redirects on credential-bearing requests.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmoriarty--moriartyruntime"></a>

### `ctx.moriarty` — `MoriartyRuntime`

The Moriarty REST service. Registered as `ctx.moriarty` (one instance per context).

Selection never depends on registration order. A configured id that is registered and `available()` wins; otherwise exactly one usable provider is required.

```ts cordis-catalog
/**
 * Register a REST backend. Throws {@link MoriartyError} `MORIARTY_DUPLICATE_PROVIDER`
 * if its id is already registered. Returns a disposer; disposed with the calling fiber.
 * @param provider - the provider; its `id` is the registry key.
 * @returns the disposer that unregisters the provider.
 */
registerProvider(provider: MoriartyApiProvider): () => void

/**
 * List organizations for the authenticated user (`GET /v1/organizations/me`).
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the organizations the token can see.
 */
async listOrganizations(signal?: AbortSignal): Promise<readonly Organization[]>

/**
 * List businesses in one organization (`GET /v1/businesses/{organizationId}/list`).
 * @param request - organization and optional page/search.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns one page of businesses.
 */
async listBusinesses(request: ListBusinessesRequest, signal?: AbortSignal): Promise<BusinessPage>

/**
 * Load one business (`GET /v1/businesses/{organizationId}/{businessId}`).
 * @param request - organization and business ids.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the business record.
 */
async getBusiness(request: GetBusinessRequest, signal?: AbortSignal): Promise<Business>

/**
 * Latest diagnostic for a business, or `null` when none exists.
 * @param request - organization and business ids.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the latest diagnostic summary, or `null` on HTTP 404.
 */
async getLatestDiagnostic(request: GetBusinessRequest, signal?: AbortSignal): Promise<DiagnosticSummary | null>

/**
 * List capsule files (`GET /v1/capsule/{organizationId}/{businessId}/files`).
 * @param request - organization, business, and optional page.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns one page of files.
 */
async listCapsuleFiles(request: ListCapsuleFilesRequest, signal?: AbortSignal): Promise<CapsuleFilePage>

/**
 * Search the France-aides catalogue (`GET /v1/france-aides`). A catalogue hit
 * is not a client eligibility verdict.
 * @param request - optional search text and page.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns one page of aides.
 */
async searchFranceAides(request: SearchFranceAidesRequest, signal?: AbortSignal): Promise<FranceAidePage>
```

Source: [`packages/moriarty/moriarty-api/src/index.ts:73`](../../packages/moriarty/moriarty-api/src/index.ts)
<!-- END GENERATED cordis-surface -->
