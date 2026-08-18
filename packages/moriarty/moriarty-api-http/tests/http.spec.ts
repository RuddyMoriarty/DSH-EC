import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import CredentialProvider from '@deepseek-ai/dsh-credentials'
import MoriartyRuntime, { BusinessId, OrganizationId } from '@deepseek-ai/dsh-moriarty-api'
import {
  isValidBaseUrl,
  MORIARTY_DEFAULT_BASE_URL,
  MORIARTY_HTTP_PROVIDER_ID,
  MoriartyHttpProvider,
} from '@deepseek-ai/dsh-moriarty-api-http'
import * as httpPlugin from '@deepseek-ai/dsh-moriarty-api-http'

const orgId = OrganizationId('org-1')
const bizId = BusinessId('biz-1')
const businessRequest = { organizationId: orgId, businessId: bizId }

const organization = { id: 'org-1', name: 'acme', displayName: 'Acme' }
const business = {
  id: 'biz-1',
  name: 'Client',
  organizationId: 'org-1',
  archived: false,
  tags: [],
  auditUpdatedAt: '2026-01-01T00:00:00Z',
}
const diagnostic = {
  id: 'diag-1',
  businessId: 'biz-1',
  businessName: 'Client',
  status: 'DONE',
  diagnosticType: 'AIDES',
  startedAt: '2026-01-01T00:00:00Z',
}
const capsuleFile = {
  id: 'file-1',
  name: 'bilan.pdf',
  contentType: 'application/pdf',
  type: 'DOCUMENT',
  version: 1,
  auditUpdatedAt: '2026-01-01T00:00:00Z',
}
const aide = { id: 7, nom: 'CIR', couvertureGeo: 'FR', status: 1 }

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

function provider(overrides: Partial<ConstructorParameters<typeof MoriartyHttpProvider>[0]> = {}) {
  return new MoriartyHttpProvider({
    baseURL: 'https://api.themoriarty.test',
    timeoutMs: 30_000,
    resolveAccessToken: () => Promise.resolve('tok'),
    ...overrides,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isValidBaseUrl', () => {
  it('accepts absolute http(s) origins without a trailing slash', () => {
    expect(isValidBaseUrl('https://api.themoriarty.app')).toBe(true)
    expect(isValidBaseUrl('http://127.0.0.1:8080')).toBe(true)
  })

  it('rejects unparseable, non-http, and trailing-slash values', () => {
    expect(isValidBaseUrl('not a url')).toBe(false)
    expect(isValidBaseUrl('ftp://api.themoriarty.app')).toBe(false)
    expect(isValidBaseUrl('https://api.themoriarty.app/')).toBe(false)
  })
})

describe('MoriartyHttpProvider availability', () => {
  it('is available with a valid origin and timeout', () => {
    expect(provider().available()).toBe(true)
    expect(provider().id).toBe(MORIARTY_HTTP_PROVIDER_ID)
  })

  it('is unavailable when the origin or timeout is invalid', () => {
    expect(provider({ baseURL: 'https://api.themoriarty.app/' }).available()).toBe(false)
    expect(provider({ timeoutMs: 0 }).available()).toBe(false)
  })
})

describe('MoriartyHttpProvider requests', () => {
  it('sends bearer auth and maps every successful endpoint', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/organizations/me')) return jsonResponse([organization])
      if (url.includes('/list?page=1&size=20&search=cli')) return jsonResponse({ content: [business] })
      if (url.endsWith('/v1/businesses/org-1/biz-1')) return jsonResponse(business)
      if (url.endsWith('/diagnostics/latest')) return jsonResponse(diagnostic)
      if (url.includes('/files?page=0')) return jsonResponse({ content: [capsuleFile] })
      if (url.includes('/v1/france-aides?search=cir')) return jsonResponse({ content: [aide] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const http = provider()
    await expect(http.listOrganizations()).resolves.toEqual([organization])
    await expect(http.listBusinesses({ organizationId: orgId, page: 1, size: 20, search: 'cli' }))
      .resolves.toMatchObject({ content: [business] })
    await expect(http.getBusiness(businessRequest)).resolves.toEqual(business)
    await expect(http.getLatestDiagnostic(businessRequest)).resolves.toEqual(diagnostic)
    await expect(http.listCapsuleFiles({ ...businessRequest, page: 0 })).resolves.toMatchObject({
      content: [capsuleFile],
    })
    await expect(http.searchFranceAides({ search: 'cir' })).resolves.toMatchObject({ content: [aide] })

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(firstUrl).toBe('https://api.themoriarty.test/v1/organizations/me')
    expect(firstInit).toMatchObject({ method: 'GET', redirect: 'error' })
    expect((firstInit.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('omits empty search from the query string', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ content: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await provider().searchFranceAides({ search: '', page: 2, size: 5 })
    const [searchUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(searchUrl).toBe('https://api.themoriarty.test/v1/france-aides?page=2&size=5')
  })

  it('omits the query string when paging fields are absent', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ content: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await provider().listBusinesses({ organizationId: orgId })
    const [listUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(listUrl).toBe('https://api.themoriarty.test/v1/businesses/org-1/list')
    await provider().listCapsuleFiles(businessRequest)
    const [capsuleUrl] = fetchMock.mock.calls[1] as unknown as [string]
    expect(capsuleUrl).toBe('https://api.themoriarty.test/v1/capsule/org-1/biz-1/files')
    await provider().searchFranceAides({})
    const [aidesUrl] = fetchMock.mock.calls[2] as unknown as [string]
    expect(aidesUrl).toBe('https://api.themoriarty.test/v1/france-aides')
  })

  it('combines a caller abort signal with the timeout', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await provider().listOrganizations(controller.signal)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal).not.toBe(controller.signal)
  })
})

describe('MoriartyHttpProvider errors', () => {
  it('throws MORIARTY_AUTH_MISSING when the token is absent or empty', async () => {
    await expect(provider({ resolveAccessToken: () => Promise.resolve(undefined) }).listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_AUTH_MISSING' }))
    await expect(provider({ resolveAccessToken: () => Promise.resolve('') }).listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_AUTH_MISSING' }))
  })

  it('maps HTTP 401, 403, 404, and other failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 401 })))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_AUTH_MISSING' }))

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 403 })))
    await expect(provider().getBusiness(businessRequest))
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_FORBIDDEN' }))

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 404 })))
    await expect(provider().getBusiness(businessRequest))
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_NOT_FOUND' }))

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 500 })))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_HTTP_ERROR' }))
  })

  it('maps diagnostic HTTP 404 to null and rethrows other diagnostic failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 404 })))
    await expect(provider().getLatestDiagnostic(businessRequest)).resolves.toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 500 })))
    await expect(provider().getLatestDiagnostic(businessRequest))
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_HTTP_ERROR' }))
  })

  it('maps abort, redirect, network, and unprocessable JSON failures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_ABORTED' }))

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('redirect mode is set to error'))))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_REDIRECT_REFUSED' }))

    const nestedRedirect = new TypeError('fetch failed', { cause: new Error('unexpected redirect') })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(nestedRedirect)))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_REDIRECT_REFUSED' }))

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('connection refused'))))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_HTTP_ERROR' }))

    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_INVALID_RESPONSE' }))

    const abortedBody = {
      json: () => Promise.reject(new DOMException('aborted', 'AbortError')),
      ok: true,
      status: 200,
    }
    vi.stubGlobal('fetch', vi.fn(async () => abortedBody as unknown as Response))
    await expect(provider().listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_ABORTED' }))
  })
})

describe('moriarty-api-http plugin registration', () => {
  it('has no default export and keeps name/inject/Config through unwrapExports', () => {
    expect('default' in httpPlugin).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(httpPlugin) as Record<string, unknown>
    expect(unwrapped).toBe(httpPlugin)
    expect(unwrapped.name).toBe('moriarty-api-http')
    expect(unwrapped.inject).toEqual(['moriarty'])
    expect(typeof unwrapped.apply).toBe('function')
  })

  it('registers the provider into ctx.moriarty (HMR-safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))
    const ctx = new Context()
    await ctx.plugin(MoriartyRuntime, { provider: MORIARTY_HTTP_PROVIDER_ID })
    const fiber = await ctx.plugin(httpPlugin, {
      baseURL: 'https://api.themoriarty.test',
      accessTokenEnv: 'MORIARTY_ACCESS_TOKEN',
    })
    const prev = process.env.MORIARTY_ACCESS_TOKEN
    process.env.MORIARTY_ACCESS_TOKEN = 'env-tok'
    try {
      await expect(ctx.moriarty.listOrganizations()).resolves.toEqual([])
    } finally {
      if (prev === undefined) delete process.env.MORIARTY_ACCESS_TOKEN
      else process.env.MORIARTY_ACCESS_TOKEN = prev
    }
    await fiber.dispose()
    await expect(ctx.moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_CONFIGURED_MISSING',
    }))
  })

  it('rejects a non-positive or oversized timeoutMs', async () => {
    const ctx = new Context()
    await ctx.plugin(MoriartyRuntime)
    expect(() => httpPlugin.apply(ctx, { timeoutMs: 0 })).toThrow(/timeoutMs must be a positive integer/)
    expect(() => httpPlugin.apply(ctx, { timeoutMs: 1.5 })).toThrow(/timeoutMs must be a positive integer/)
    expect(() => httpPlugin.apply(ctx, { timeoutMs: 2_147_483_648 }))
      .toThrow(/timeoutMs must be no greater than/)
  })

  it('treats an empty credentials value as missing', async () => {
    const ctx = new Context()
    await ctx.plugin(MoriartyRuntime)
    class EmptyCredentials extends CredentialProvider {
      override resolve() {
        return Promise.resolve({ value: '', source: 'test' })
      }

      override describe() {
        return Promise.resolve({ configured: false, writable: true })
      }

      override set() {
        return Promise.resolve()
      }

      override unset() {
        return Promise.resolve()
      }
    }
    await ctx.plugin(EmptyCredentials)
    httpPlugin.apply(ctx, { baseURL: 'https://api.themoriarty.test' })
    await expect(ctx.moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_AUTH_MISSING',
    }))
  })

  it('resolves the bearer from ctx.credentials when that service is present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])))
    const ctx = new Context()
    await ctx.plugin(MoriartyRuntime)
    class MemoryCredentials extends CredentialProvider {
      override resolve() {
        return Promise.resolve({ value: 'stored-tok', source: 'test' })
      }

      override describe() {
        return Promise.resolve({ configured: true, writable: true, source: 'test' })
      }

      override set() {
        return Promise.resolve()
      }

      override unset() {
        return Promise.resolve()
      }
    }
    await ctx.plugin(MemoryCredentials)
    httpPlugin.apply(ctx, { baseURL: 'https://api.themoriarty.test' })
    await ctx.moriarty.listOrganizations()
    const [, init] = (vi.mocked(fetch).mock.calls[0] ?? []) as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer stored-tok')
  })

  it('falls back to the launch environment when credentials are absent, and fails when both are empty', async () => {
    const prevToken = process.env.MORIARTY_ACCESS_TOKEN
    const prevBase = process.env.MORIARTY_API_BASE_URL
    delete process.env.MORIARTY_ACCESS_TOKEN
    delete process.env.MORIARTY_API_BASE_URL
    try {
      const ctx = new Context()
      await ctx.plugin(MoriartyRuntime)
      httpPlugin.apply(ctx, {})
      await expect(ctx.moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
        code: 'MORIARTY_AUTH_MISSING',
      }))

      process.env.MORIARTY_ACCESS_TOKEN = 'env-tok'
      process.env.MORIARTY_API_BASE_URL = 'https://api.themoriarty.env'
      const envCtx = new Context()
      await envCtx.plugin(MoriartyRuntime)
      const fetchMock = vi.fn(async () => jsonResponse([]))
      vi.stubGlobal('fetch', fetchMock)
      httpPlugin.apply(envCtx, {})
      await envCtx.moriarty.listOrganizations()
      const [envUrl] = fetchMock.mock.calls[0] as unknown as [string]
      expect(envUrl).toBe('https://api.themoriarty.env/v1/organizations/me')
    } finally {
      if (prevToken === undefined) delete process.env.MORIARTY_ACCESS_TOKEN
      else process.env.MORIARTY_ACCESS_TOKEN = prevToken
      if (prevBase === undefined) delete process.env.MORIARTY_API_BASE_URL
      else process.env.MORIARTY_API_BASE_URL = prevBase
    }
  })

  it('uses the shipped default origin when neither config nor env names one', () => {
    expect(MORIARTY_DEFAULT_BASE_URL).toBe('https://api.themoriarty.app')
  })
})

describe('MoriartyHttpProvider redirect policy', () => {
  const targetRequests: IncomingMessage[] = []
  let redirectOrigin: string
  let targetOrigin: string
  const targetServer = createServer((request, response) => {
    targetRequests.push(request)
    request.resume()
    response.writeHead(204).end()
  })
  const redirectServer = createServer((request, response) => {
    request.resume()
    response.writeHead(302, { location: `${targetOrigin}/collect` }).end()
  })

  beforeAll(async () => {
    await listen(targetServer)
    targetOrigin = originOf(targetServer)
    await listen(redirectServer)
    redirectOrigin = originOf(redirectServer)
  })

  afterAll(async () => {
    await Promise.all([close(targetServer), close(redirectServer)])
  })

  it('rejects the redirect before contacting Location', async () => {
    targetRequests.length = 0
    await expect(provider({ baseURL: redirectOrigin }).listOrganizations())
      .rejects.toThrow(expect.objectContaining({ code: 'MORIARTY_REDIRECT_REFUSED' }))
    expect(targetRequests).toHaveLength(0)
  })
})

function originOf(server: Server): string {
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function close(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close(error => error === undefined ? resolve() : reject(error))
  })
}
