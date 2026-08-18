/**
 * HTTP(S) Moriarty REST provider: bearer token, no automatic redirects, JSON
 * bodies mapped into `ctx.moriarty` records.
 * @module @deepseek-ai/dsh-moriarty-api-http/provider
 */

import {
  MoriartyError,
  type Business,
  type BusinessPage,
  type CapsuleFilePage,
  type DiagnosticSummary,
  type FranceAidePage,
  type GetBusinessRequest,
  type ListBusinessesRequest,
  type ListCapsuleFilesRequest,
  type MoriartyApiProvider,
  type Organization,
  type SearchFranceAidesRequest,
} from '@deepseek-ai/dsh-moriarty-api'
import {
  parseBusiness,
  parseBusinessPage,
  parseCapsuleFilePage,
  parseDiagnosticSummary,
  parseFranceAidePage,
  parseOrganizations,
} from './parse.ts'

/** Stable id this provider registers under. */
export const MORIARTY_HTTP_PROVIDER_ID = 'moriarty-http'

/** Default moriarty-be origin (no trailing slash). */
export const MORIARTY_DEFAULT_BASE_URL = 'https://api.themoriarty.app'

/** Attribution header sent on every request. */
const USER_AGENT = 'dsh-moriarty/0.1.0'

/** Resolved provider options (the plugin's `apply` supplies defaults). */
export interface MoriartyHttpProviderOptions {
  /** API origin, no trailing slash. */
  baseURL: string
  /** Resolve the bearer for this request; empty/absent makes the call fail. */
  resolveAccessToken: () => Promise<string | undefined>
  /** Resource-backstop timeout in milliseconds. */
  timeoutMs: number
}

/**
 * moriarty-be HTTP provider. Redirects fail closed so a bearer is never
 * forwarded to another origin.
 */
export class MoriartyHttpProvider implements MoriartyApiProvider {
  readonly id = MORIARTY_HTTP_PROVIDER_ID

  constructor(private readonly options: MoriartyHttpProviderOptions) {}

  available(): boolean {
    return isValidBaseUrl(this.options.baseURL)
      && Number.isFinite(this.options.timeoutMs)
      && this.options.timeoutMs > 0
  }

  /**
   * @param signal - optional cancellation signal.
   * @returns organizations for the current token.
   */
  listOrganizations(signal?: AbortSignal): Promise<readonly Organization[]> {
    return this.requestJson('GET', '/v1/organizations/me', signal, parseOrganizations)
  }

  /**
   * @param request - organization and optional page/search.
   * @param signal - optional cancellation signal.
   * @returns one business page.
   */
  listBusinesses(request: ListBusinessesRequest, signal?: AbortSignal): Promise<BusinessPage> {
    const query = pageQuery(request.page, request.size, request.search)
    return this.requestJson(
      'GET',
      `/v1/businesses/${encodeURIComponent(request.organizationId)}/list${query}`,
      signal,
      parseBusinessPage,
    )
  }

  /**
   * @param request - organization and business ids.
   * @param signal - optional cancellation signal.
   * @returns the business.
   */
  getBusiness(request: GetBusinessRequest, signal?: AbortSignal): Promise<Business> {
    return this.requestJson(
      'GET',
      `/v1/businesses/${encodeURIComponent(request.organizationId)}/${encodeURIComponent(request.businessId)}`,
      signal,
      parseBusiness,
    )
  }

  /**
   * @param request - organization and business ids.
   * @param signal - optional cancellation signal.
   * @returns the latest diagnostic, or `null` on HTTP 404.
   */
  async getLatestDiagnostic(request: GetBusinessRequest, signal?: AbortSignal): Promise<DiagnosticSummary | null> {
    try {
      return await this.requestJson(
        'GET',
        `/v1/businesses/${encodeURIComponent(request.organizationId)}/${encodeURIComponent(request.businessId)}/diagnostics/latest`,
        signal,
        parseDiagnosticSummary,
      )
    } catch (error: unknown) {
      if (error instanceof MoriartyError && error.code === 'MORIARTY_NOT_FOUND') return null
      throw error
    }
  }

  /**
   * @param request - organization, business, and optional page.
   * @param signal - optional cancellation signal.
   * @returns one capsule file page.
   */
  listCapsuleFiles(request: ListCapsuleFilesRequest, signal?: AbortSignal): Promise<CapsuleFilePage> {
    const query = pageQuery(request.page, request.size)
    return this.requestJson(
      'GET',
      `/v1/capsule/${encodeURIComponent(request.organizationId)}/${encodeURIComponent(request.businessId)}/files${query}`,
      signal,
      parseCapsuleFilePage,
    )
  }

  /**
   * @param request - optional search text and page.
   * @param signal - optional cancellation signal.
   * @returns one France-aides page.
   */
  searchFranceAides(request: SearchFranceAidesRequest, signal?: AbortSignal): Promise<FranceAidePage> {
    const query = pageQuery(request.page, request.size, request.search)
    return this.requestJson('GET', `/v1/france-aides${query}`, signal, parseFranceAidePage)
  }

  private async requestJson<T>(
    method: 'GET',
    path: string,
    signal: AbortSignal | undefined,
    parse: (body: unknown) => T,
  ): Promise<T> {
    const token = await this.options.resolveAccessToken()
    if (token === undefined || token.length === 0) {
      throw new MoriartyError(
        'Moriarty access token is missing (set MORIARTY_ACCESS_TOKEN)',
        'MORIARTY_AUTH_MISSING',
      )
    }
    const timeout = AbortSignal.timeout(this.options.timeoutMs)
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    let response: Response
    try {
      response = await fetch(`${this.options.baseURL}${path}`, {
        method,
        redirect: 'error',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          'user-agent': USER_AGENT,
        },
        signal: combined,
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw new MoriartyError('Moriarty request aborted', 'MORIARTY_ABORTED', { cause: error })
      if (isRedirectError(error)) {
        throw new MoriartyError(
          'Moriarty HTTP redirect refused (credential-bearing requests do not follow Location)',
          'MORIARTY_REDIRECT_REFUSED',
          { cause: error },
        )
      }
      throw new MoriartyError(`Moriarty request failed: ${String(error)}`, 'MORIARTY_HTTP_ERROR', { cause: error })
    }

    if (response.status === 401) {
      throw new MoriartyError('Moriarty rejected the access token (HTTP 401)', 'MORIARTY_AUTH_MISSING')
    }
    if (response.status === 403) {
      throw new MoriartyError('Moriarty forbade this organization or resource (HTTP 403)', 'MORIARTY_FORBIDDEN')
    }
    if (response.status === 404) {
      throw new MoriartyError(`Moriarty resource not found: ${path}`, 'MORIARTY_NOT_FOUND')
    }
    if (!response.ok) {
      throw new MoriartyError(`Moriarty API error (HTTP ${response.status})`, 'MORIARTY_HTTP_ERROR')
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (error: unknown) {
      if (isAbortError(error)) throw new MoriartyError('Moriarty request aborted', 'MORIARTY_ABORTED', { cause: error })
      throw new MoriartyError(
        `Moriarty returned an unprocessable JSON body: ${String(error)}`,
        'MORIARTY_INVALID_RESPONSE',
        { cause: error },
      )
    }
    return parse(body)
  }
}

/**
 * True when `baseURL` parses as an absolute http(s) URL without a trailing slash.
 * @param baseURL - origin to check.
 * @returns whether the origin is usable as a Moriarty HTTP `baseURL`.
 */
export function isValidBaseUrl(baseURL: string): boolean {
  if (!URL.canParse(baseURL)) return false
  const parsed = new URL(baseURL)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  return !baseURL.endsWith('/')
}

function pageQuery(page: number | undefined, size: number | undefined, search?: string): string {
  const params = new URLSearchParams()
  if (page !== undefined) params.set('page', String(page))
  if (size !== undefined) params.set('size', String(size))
  if (search !== undefined && search.length > 0) params.set('search', search)
  const encoded = params.toString()
  return encoded.length > 0 ? `?${encoded}` : ''
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isRedirectError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (/redirect/i.test(current.message)) return true
  }
  return false
}
