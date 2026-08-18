import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import MoriartyRuntime, {
  BusinessId,
  MoriartyError,
  OrganizationId,
  type MoriartyApiProvider,
} from '@deepseek-ai/dsh-moriarty-api'

const available = true
const unavailable = false

function emptyPage() {
  return { content: [], totalElements: 0, number: 0, size: 0, empty: true }
}

function makeProvider(
  id: string,
  isAvailable: boolean,
  marker = id,
): MoriartyApiProvider {
  return {
    id,
    available: () => isAvailable,
    listOrganizations: () => Promise.resolve([{
      id: OrganizationId(marker),
      name: marker,
      displayName: marker,
    }]),
    listBusinesses: () => Promise.resolve(emptyPage()),
    getBusiness: () => Promise.resolve({
      id: BusinessId(marker),
      name: marker,
      organizationId: OrganizationId(marker),
      archived: false,
      tags: [],
      auditUpdatedAt: '2026-01-01T00:00:00Z',
    }),
    getLatestDiagnostic: () => Promise.resolve(null),
    listCapsuleFiles: () => Promise.resolve(emptyPage()),
    searchFranceAides: () => Promise.resolve(emptyPage()),
  }
}

async function mount(config: ConstructorParameters<typeof MoriartyRuntime>[1] = {}) {
  const ctx = new Context()
  await ctx.plugin(MoriartyRuntime, config)
  return { ctx, moriarty: ctx.moriarty }
}

let previousProvider: string | undefined
beforeEach(() => {
  previousProvider = process.env.MORIARTY_API_PROVIDER
  delete process.env.MORIARTY_API_PROVIDER
})
afterEach(() => {
  if (previousProvider === undefined) delete process.env.MORIARTY_API_PROVIDER
  else process.env.MORIARTY_API_PROVIDER = previousProvider
})

describe('MoriartyRuntime registration', () => {
  it('registers a provider and unregisters it via the returned disposer', async () => {
    const { moriarty } = await mount()
    const dispose = moriarty.registerProvider(makeProvider('moriarty-http', available))
    await expect(moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'moriarty-http' }])
    dispose()
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_UNAVAILABLE',
    }))
  })

  it('throws MORIARTY_DUPLICATE_PROVIDER on a duplicate id', async () => {
    const { moriarty } = await mount()
    moriarty.registerProvider(makeProvider('moriarty-http', available))
    expect(() => moriarty.registerProvider(makeProvider('moriarty-http', available)))
      .toThrow(expect.objectContaining({ code: 'MORIARTY_DUPLICATE_PROVIDER' }))
  })

  it('disposes provider registrations when the contributing fiber is disposed', async () => {
    const { ctx, moriarty } = await mount()
    const fiber = await ctx.plugin(Object.assign((inner: Context) => {
      inner.moriarty.registerProvider(makeProvider('moriarty-http', available))
    }, { inject: ['moriarty'] }))
    await expect(moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'moriarty-http' }])
    await fiber.dispose()
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_UNAVAILABLE',
    }))
  })
})

describe('MoriartyRuntime execution resolution', () => {
  it('throws MORIARTY_PROVIDER_UNAVAILABLE when nothing is registered', async () => {
    const { moriarty } = await mount()
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_UNAVAILABLE',
    }))
  })

  it('throws MORIARTY_PROVIDER_UNAVAILABLE when providers exist but none are usable', async () => {
    const { moriarty } = await mount()
    moriarty.registerProvider(makeProvider('moriarty-http', unavailable))
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_UNAVAILABLE',
    }))
  })

  it('throws MORIARTY_PROVIDER_CONFIGURED_MISSING for an unregistered configured id', async () => {
    const { moriarty } = await mount({ provider: 'other' })
    moriarty.registerProvider(makeProvider('moriarty-http', available))
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_CONFIGURED_MISSING',
    }))
  })

  it('throws MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE for an unusable configured id', async () => {
    const { moriarty } = await mount({ provider: 'moriarty-http' })
    moriarty.registerProvider(makeProvider('moriarty-http', unavailable))
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE',
    }))
  })

  it('throws MORIARTY_PROVIDER_AMBIGUOUS rather than picking by order', async () => {
    const { moriarty } = await mount()
    moriarty.registerProvider(makeProvider('a', available))
    moriarty.registerProvider(makeProvider('b', available))
    await expect(moriarty.listOrganizations()).rejects.toThrow(expect.objectContaining({
      code: 'MORIARTY_PROVIDER_AMBIGUOUS',
    }))
  })

  it('runs the configured provider even when another usable provider is registered', async () => {
    const { moriarty } = await mount({ provider: 'b' })
    moriarty.registerProvider(makeProvider('a', available))
    moriarty.registerProvider(makeProvider('b', available))
    await expect(moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'b' }])
  })

  it('ignores unusable providers when auto-selecting', async () => {
    const { moriarty } = await mount()
    moriarty.registerProvider(makeProvider('a', available))
    moriarty.registerProvider(makeProvider('b', unavailable))
    await expect(moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'a' }])
  })

  it('does not let registration order change auto-selection', async () => {
    const a = await mount()
    a.moriarty.registerProvider(makeProvider('dead', unavailable))
    a.moriarty.registerProvider(makeProvider('live', available))
    await expect(a.moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'live' }])

    const b = await mount()
    b.moriarty.registerProvider(makeProvider('live', available))
    b.moriarty.registerProvider(makeProvider('dead', unavailable))
    await expect(b.moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'live' }])
  })

  it('forwards every operation and the abort signal to the selected provider', async () => {
    const { moriarty } = await mount()
    const seen: (AbortSignal | undefined)[] = []
    const request = {
      organizationId: OrganizationId('org-1'),
      businessId: BusinessId('biz-1'),
    }
    moriarty.registerProvider({
      id: 'stub',
      available: () => available,
      listOrganizations: (signal) => {
        seen.push(signal)
        return Promise.resolve([])
      },
      listBusinesses: (_request, signal) => {
        seen.push(signal)
        return Promise.resolve(emptyPage())
      },
      getBusiness: (_request, signal) => {
        seen.push(signal)
        return Promise.resolve({
          id: request.businessId,
          name: 'n',
          organizationId: request.organizationId,
          archived: false,
          tags: [],
          auditUpdatedAt: 't',
        })
      },
      getLatestDiagnostic: (_request, signal) => {
        seen.push(signal)
        return Promise.resolve(null)
      },
      listCapsuleFiles: (_request, signal) => {
        seen.push(signal)
        return Promise.resolve(emptyPage())
      },
      searchFranceAides: (_request, signal) => {
        seen.push(signal)
        return Promise.resolve(emptyPage())
      },
    })
    const controller = new AbortController()
    await moriarty.listOrganizations(controller.signal)
    await moriarty.listBusinesses({ organizationId: request.organizationId }, controller.signal)
    await moriarty.getBusiness(request, controller.signal)
    await moriarty.getLatestDiagnostic(request, controller.signal)
    await moriarty.listCapsuleFiles(request, controller.signal)
    await moriarty.searchFranceAides({}, controller.signal)
    expect(seen).toHaveLength(6)
    expect(seen.every(signal => signal === controller.signal)).toBe(true)
  })
})

describe('id constructors', () => {
  it('brands a trimmed non-empty organization id', () => {
    expect(OrganizationId(' org-1 ')).toBe('org-1')
  })

  it('rejects a blank organization id', () => {
    expect(() => OrganizationId('  ')).toThrow(expect.objectContaining({ code: 'MORIARTY_INVALID_REQUEST' }))
  })

  it('brands a trimmed non-empty business id', () => {
    expect(BusinessId(' biz-1 ')).toBe('biz-1')
  })

  it('rejects a blank business id', () => {
    expect(() => BusinessId('')).toThrow(expect.objectContaining({ code: 'MORIARTY_INVALID_REQUEST' }))
  })
})

describe('MoriartyError', () => {
  it('is a HarnessError carrying its code', () => {
    const error = new MoriartyError('boom', 'MORIARTY_HTTP_ERROR')
    expect(error.code).toBe('MORIARTY_HTTP_ERROR')
    expect(error.name).toBe('MoriartyError')
  })
})

describe('MORIARTY_API_PROVIDER', () => {
  it('feeds the same configured-id field as config.provider', async () => {
    process.env.MORIARTY_API_PROVIDER = 'b'
    const { moriarty } = await mount()
    moriarty.registerProvider(makeProvider('a', available))
    moriarty.registerProvider(makeProvider('b', available))
    await expect(moriarty.listOrganizations()).resolves.toMatchObject([{ name: 'b' }])
  })
})
