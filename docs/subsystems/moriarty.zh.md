# Moriarty REST

[English](moriarty.md) | 中文

Moriarty REST 能力——`ctx.moriarty` 上的 [capability seam](../../.agents/notes/implemented/architecture/2026-08-18-moriarty-api-capability-seam.md)，拆分到多个包：Service Definition（[dsh-moriarty-api](../../packages/moriarty/moriarty-api)，`ctx.moriarty` + 提供方注册表）、Service Provider（[dsh-moriarty-api-http](../../packages/moriarty/moriarty-api-http)）和 Consumer（[dsh-tool-moriarty](../../packages/moriarty/tool-moriarty)，`moriarty_*` 工具 schema）。Moriarty 是**可选的产品 overlay**，不是 agent-loop 主干的一部分——因此其记录放在这里，而不是 [core.md](core.md)。更换提供方不会改变模型如何请求组织或 France-aides 搜索。

来源：[`packages/moriarty/moriarty-api/src/types.ts`](../../packages/moriarty/moriarty-api/src/types.ts)

提供方注册的是**能力**而非工具。面向模型的名称、schema、提示词指引和呈现都位于唯一的 `dsh-tool-moriarty` Consumer。最新诊断上的 HTTP 404 是领域空值（`null`），不是传输失败。France-aides 目录命中不是客户资格判定。

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

## 提供方可用性

提供方的 `available(): boolean` 是便宜的**局部**检查（可解析的源站、正超时），且**禁止发起网络调用**。它是执行时选择的输入。选择绝不依赖注册顺序：显式提供方 id（配置 `provider`，或由 `$MORIARTY_API_PROVIDER` 提供相同字段）在已注册且可用时胜出；否则要求恰好一个可用提供方。

## 错误

`MoriartyError extends HarnessError`（[core.md](core.md) 错误分类体系）带有 `code: string`（开放）：提供方可在不编辑 `dsh-moriarty-api` 的情况下抛出自己的 code。seam 中立 code 包括 `MORIARTY_DUPLICATE_PROVIDER`、`MORIARTY_PROVIDER_UNAVAILABLE`、`MORIARTY_PROVIDER_CONFIGURED_MISSING`、`MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE`、`MORIARTY_PROVIDER_AMBIGUOUS` 和 `MORIARTY_INVALID_REQUEST`。HTTP 提供方 code 包括 `MORIARTY_AUTH_MISSING`、`MORIARTY_FORBIDDEN`、`MORIARTY_NOT_FOUND`、`MORIARTY_ABORTED`、`MORIARTY_REDIRECT_REFUSED`、`MORIARTY_HTTP_ERROR` 和 `MORIARTY_INVALID_RESPONSE`。

HTTP 提供方发送来自 `MORIARTY_ACCESS_TOKEN` 的用户 JWT，绝不是 `ADMIN_API_KEY`，并拒绝带凭据请求上的重定向。

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
