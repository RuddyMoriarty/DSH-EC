/**
 * Service Definition for the Moriarty REST capability (`ctx.moriarty`): provider
 * registry and provider-selecting execution for organization, business, capsule,
 * diagnostic, and France-aides reads. Duplicate ids are rejected. At execution
 * time a configured provider must exist and be usable; without one, exactly one
 * usable provider is required, so selection never depends on registration order.
 * @module @deepseek-ai/dsh-moriarty-api
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  Business,
  BusinessPage,
  CapsuleFilePage,
  DiagnosticSummary,
  FranceAidePage,
  GetBusinessRequest,
  ListBusinessesRequest,
  ListCapsuleFilesRequest,
  MoriartyApiProvider,
  Organization,
  SearchFranceAidesRequest,
} from './types.ts'
import { MoriartyError } from './types.ts'

export { MoriartyError, OrganizationId, BusinessId } from './types.ts'
export type {
  Business,
  BusinessPage,
  CapsuleFile,
  CapsuleFilePage,
  DiagnosticSummary,
  FranceAide,
  FranceAidePage,
  GetBusinessRequest,
  ListBusinessesRequest,
  ListCapsuleFilesRequest,
  MoriartyApiProvider,
  Organization,
  SearchFranceAidesRequest,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    moriarty: MoriartyRuntime
  }
}

/** Selection inputs for execution-time provider resolution. */
interface Selection {
  readonly configuredId?: string
  readonly providers: ReadonlyMap<string, MoriartyApiProvider>
}

/**
 * Config for the Moriarty seam. `provider` pins which backend wins; omitted
 * auto-selects when exactly one usable provider is registered. Operational
 * env overrides feed this same field (`$MORIARTY_API_PROVIDER`).
 */
export interface MoriartyRuntimeConfig {
  /** Explicit provider id. Omitted = auto-select when exactly one usable. */
  readonly provider?: string
}

/**
 * The Moriarty REST service. Registered as `ctx.moriarty` (one instance per context).
 *
 * Selection never depends on registration order. A configured id that is
 * registered and `available()` wins; otherwise exactly one usable provider is
 * required.
 */
export class MoriartyRuntime extends Service {
  /**
   * Provider selection config. `$MORIARTY_API_PROVIDER` feeds the same field
   * as `provider` and is not a hidden priority chain.
   */
  static Config: z<MoriartyRuntimeConfig> = z.object({
    provider: z.string(),
  })

  private providers = new Map<string, MoriartyApiProvider>()
  private readonly providerId: string | undefined

  /**
   * @param ctx - Cordis context this service is installed on.
   * @param config - optional explicit provider id.
   */
  constructor(ctx: Context, config: MoriartyRuntimeConfig = {}) {
    super(ctx, 'moriarty')
    this.providerId = config.provider ?? process.env.MORIARTY_API_PROVIDER
  }

  /**
   * Register a REST backend. Throws {@link MoriartyError} `MORIARTY_DUPLICATE_PROVIDER`
   * if its id is already registered. Returns a disposer; disposed with the calling fiber.
   * @param provider - the provider; its `id` is the registry key.
   * @returns the disposer that unregisters the provider.
   */
  registerProvider(provider: MoriartyApiProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new MoriartyError(
        `a Moriarty provider with id "${provider.id}" is already registered`,
        'MORIARTY_DUPLICATE_PROVIDER',
      )
    }
    const store = this.providers
    const dispose = this.ctx.effect(function* () {
      store.set(provider.id, provider)
      yield () => store.delete(provider.id)
    }, 'moriarty.registerProvider()')
    return () => void dispose()
  }

  /**
   * List organizations for the authenticated user (`GET /v1/organizations/me`).
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the organizations the token can see.
   */
  async listOrganizations(signal?: AbortSignal): Promise<readonly Organization[]> {
    return this.resolveProvider().listOrganizations(signal)
  }

  /**
   * List businesses in one organization (`GET /v1/businesses/{organizationId}/list`).
   * @param request - organization and optional page/search.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns one page of businesses.
   */
  async listBusinesses(request: ListBusinessesRequest, signal?: AbortSignal): Promise<BusinessPage> {
    return this.resolveProvider().listBusinesses(request, signal)
  }

  /**
   * Load one business (`GET /v1/businesses/{organizationId}/{businessId}`).
   * @param request - organization and business ids.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the business record.
   */
  async getBusiness(request: GetBusinessRequest, signal?: AbortSignal): Promise<Business> {
    return this.resolveProvider().getBusiness(request, signal)
  }

  /**
   * Latest diagnostic for a business, or `null` when none exists.
   * @param request - organization and business ids.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the latest diagnostic summary, or `null` on HTTP 404.
   */
  async getLatestDiagnostic(request: GetBusinessRequest, signal?: AbortSignal): Promise<DiagnosticSummary | null> {
    return this.resolveProvider().getLatestDiagnostic(request, signal)
  }

  /**
   * List capsule files (`GET /v1/capsule/{organizationId}/{businessId}/files`).
   * @param request - organization, business, and optional page.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns one page of files.
   */
  async listCapsuleFiles(request: ListCapsuleFilesRequest, signal?: AbortSignal): Promise<CapsuleFilePage> {
    return this.resolveProvider().listCapsuleFiles(request, signal)
  }

  /**
   * Search the France-aides catalogue (`GET /v1/france-aides`). A catalogue hit
   * is not a client eligibility verdict.
   * @param request - optional search text and page.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns one page of aides.
   */
  async searchFranceAides(request: SearchFranceAidesRequest, signal?: AbortSignal): Promise<FranceAidePage> {
    return this.resolveProvider().searchFranceAides(request, signal)
  }

  private resolveProvider(): MoriartyApiProvider {
    return resolveProvider({
      providers: this.providers,
      ...this.providerId !== undefined ? { configuredId: this.providerId } : {},
    })
  }
}

/** Resolve the selected provider or throw the matching {@link MoriartyError}. */
function resolveProvider(selection: Selection): MoriartyApiProvider {
  const { configuredId, providers } = selection
  if (configuredId !== undefined) {
    const provider = providers.get(configuredId)
    if (!provider) {
      throw new MoriartyError(
        `configured Moriarty provider "${configuredId}" is not registered`,
        'MORIARTY_PROVIDER_CONFIGURED_MISSING',
      )
    }
    if (!provider.available()) {
      throw new MoriartyError(
        `configured Moriarty provider "${configuredId}" is registered but unavailable`,
        'MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE',
      )
    }
    return provider
  }
  const usable = [...providers.values()].filter(provider => provider.available())
  const [single] = usable
  if (single === undefined) {
    throw new MoriartyError('no usable Moriarty provider is registered', 'MORIARTY_PROVIDER_UNAVAILABLE')
  }
  if (usable.length > 1) {
    const ids = usable.map(provider => provider.id).join(', ')
    throw new MoriartyError(
      `multiple usable Moriarty providers are registered (${ids}); configure one explicitly`,
      'MORIARTY_PROVIDER_AMBIGUOUS',
    )
  }
  return single
}

export default MoriartyRuntime
