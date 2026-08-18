import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import MoriartyRuntime, {
  BusinessId,
  OrganizationId,
  type MoriartyApiProvider,
} from '@deepseek-ai/dsh-moriarty-api'
import * as ToolMoriarty from '@deepseek-ai/dsh-tool-moriarty'
import {
  formatBusiness,
  formatBusinessPage,
  formatCapsuleFilePage,
  formatDiagnostic,
  formatFranceAidePage,
  formatOrganizations,
  parseRequiredString,
  presentMoriartyCall,
  projectBusiness,
  projectDiagnostic,
  projectFranceAide,
} from '@deepseek-ai/dsh-tool-moriarty'

const testToolSignal = new AbortController().signal
const orgId = OrganizationId('org-1')
const bizId = BusinessId('biz-1')

const organization = { id: orgId, name: 'acme', displayName: 'Acme' }
const business = {
  id: bizId,
  name: 'Client',
  organizationId: orgId,
  archived: false,
  tags: [],
  auditUpdatedAt: '2026-01-01T00:00:00Z',
  siret: '123',
}
const emptyPage = { content: [], totalElements: 0, number: 0, size: 0, empty: true }
const diagnostic = {
  id: 'diag-1',
  businessId: bizId,
  businessName: 'Client',
  status: 'DONE',
  diagnosticType: 'AIDES',
  startedAt: 't',
  totalEligible: 2,
}
const file = {
  id: 'file-1',
  name: 'bilan.pdf',
  contentType: 'application/pdf',
  type: 'DOCUMENT',
  version: 1,
  auditUpdatedAt: 't',
}
const aide = { id: 7, nom: 'CIR', couvertureGeo: 'FR', status: 1 }

function stubProvider(overrides: Partial<MoriartyApiProvider> = {}): MoriartyApiProvider {
  return {
    id: 'stub',
    available: () => true,
    listOrganizations: () => Promise.resolve([organization]),
    listBusinesses: () => Promise.resolve({ ...emptyPage, content: [business], empty: false, totalElements: 1, size: 1 }),
    getBusiness: () => Promise.resolve(business),
    getLatestDiagnostic: () => Promise.resolve(diagnostic),
    listCapsuleFiles: () => Promise.resolve({ ...emptyPage, content: [file], empty: false, totalElements: 1, size: 1 }),
    searchFranceAides: () => Promise.resolve({ ...emptyPage, content: [aide], empty: false, totalElements: 1, size: 1 }),
    ...overrides,
  }
}

async function mount(provider: MoriartyApiProvider = stubProvider()): Promise<{
  ctx: Context
  call: (name: string, args: unknown) => Promise<ToolExecutionResult>
}> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(MoriartyRuntime)
  ctx.moriarty.registerProvider(provider)
  await ctx.plugin(ToolMoriarty)
  let counter = 0
  const call = (name: string, args: unknown) => ctx.tools.execute({
    signal: testToolSignal,
    callId: CallId(`call-${++counter}`),
    name,
    arguments: args,
  })
  return { ctx, call }
}

function textOf(result: ToolExecutionResult): string {
  return result.content.map(block => block.type === 'text' ? block.text : '').join('')
}

describe('formatting', () => {
  it('renders organizations, businesses, and empty lists with the owning endpoint', () => {
    expect(formatOrganizations([organization])).toContain('Acme (org-1)')
    expect(formatOrganizations([])).toContain('No organizations.')
    expect(formatOrganizations([])).toContain('GET /v1/organizations/me')
    expect(formatBusinessPage({ ...emptyPage, content: [business], empty: false }, 'org-1'))
      .toContain('SIRET 123')
    expect(formatBusinessPage(
      { ...emptyPage, content: [{ ...business, siret: undefined }], empty: false },
      'org-1',
    )).not.toContain('SIRET')
    expect(formatBusinessPage(emptyPage, 'org-1')).toContain('No businesses')
    expect(formatBusinessPage({ ...emptyPage, empty: false }, 'org-1')).toContain('No businesses')
    expect(formatBusiness({ ...business, siret: undefined })).not.toContain('SIRET')
    expect(formatBusiness(business)).toContain('GET /v1/businesses/org-1/biz-1')
  })

  it('renders diagnostics, capsule files, and aides, including empty cases', () => {
    expect(formatDiagnostic(diagnostic, 'org-1', 'biz-1')).toContain('eligible 2')
    expect(formatDiagnostic({ ...diagnostic, totalEligible: undefined }, 'org-1', 'biz-1'))
      .not.toContain('eligible')
    expect(formatDiagnostic(null, 'org-1', 'biz-1')).toContain('No diagnostic')
    expect(formatCapsuleFilePage({ ...emptyPage, content: [file], empty: false }, 'org-1', 'biz-1'))
      .toContain('bilan.pdf')
    expect(formatCapsuleFilePage(emptyPage, 'org-1', 'biz-1')).toContain('No capsule files')
    expect(formatCapsuleFilePage({ ...emptyPage, empty: false }, 'org-1', 'biz-1')).toContain('No capsule files')
    expect(formatFranceAidePage({ ...emptyPage, content: [aide], empty: false }))
      .toContain('catalogue hit is not a client eligibility verdict')
    expect(formatFranceAidePage(emptyPage)).toContain('No aides matched')
    expect(formatFranceAidePage({ ...emptyPage, empty: false })).toContain('No aides matched')
  })

  it('projects optional business, diagnostic, and aide fields when present and omits them when absent', () => {
    expect(projectBusiness(business).siret).toBe('123')
    expect(projectBusiness(business).socialReason).toBeUndefined()
    expect(projectBusiness({ ...business, siret: undefined, socialReason: 'SARL' })).toEqual({
      id: bizId,
      name: 'Client',
      organizationId: orgId,
      archived: false,
      tags: [],
      auditUpdatedAt: '2026-01-01T00:00:00Z',
      socialReason: 'SARL',
    })
    expect(projectDiagnostic(diagnostic).totalEligible).toBe(2)
    expect(projectDiagnostic({ ...diagnostic, totalEligible: undefined }).totalEligible).toBeUndefined()
    expect(projectDiagnostic({
      ...diagnostic,
      completedAt: 'done',
      errorMessage: 'partial',
    })).toMatchObject({ completedAt: 'done', errorMessage: 'partial' })
    expect(projectFranceAide(aide).objet).toBeUndefined()
    expect(projectFranceAide({ ...aide, objet: 'credit impot' }).objet).toBe('credit impot')
  })

  it('rejects blank required strings and presents a generic search card', () => {
    expect(() => parseRequiredString('  ', 'organizationId')).toThrow('non-empty')
    expect(parseRequiredString(' org-1 ', 'organizationId')).toBe('org-1')
    expect(presentMoriartyCall('List Moriarty organizations')).toEqual({
      card: 'generic',
      title: 'List Moriarty organizations',
      kind: 'search',
    })
  })
})

describe('tool-moriarty execution', () => {
  it('registers the six REST tools and the cabinet guidance section', async () => {
    const { ctx } = await mount()
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual([
      'moriarty_get_business',
      'moriarty_get_latest_diagnostic',
      'moriarty_list_businesses',
      'moriarty_list_capsule_files',
      'moriarty_list_organizations',
      'moriarty_search_france_aides',
    ])
    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.sections.some(section => section.name === 'tool:moriarty')).toBe(true)
  })

  it('executes every tool through ctx.moriarty and cites the endpoint', async () => {
    const { call } = await mount()
    expect(textOf(await call('moriarty_list_organizations', {}))).toContain('Acme')
    expect(textOf(await call('moriarty_list_businesses', {
      organizationId: 'org-1',
      page: 0,
      size: 10,
      search: 'cli',
    }))).toContain('Client')
    expect(textOf(await call('moriarty_get_business', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    }))).toContain('SIRET')
    expect(textOf(await call('moriarty_get_latest_diagnostic', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    }))).toContain('DONE')
    expect(textOf(await call('moriarty_list_capsule_files', {
      organizationId: 'org-1',
      businessId: 'biz-1',
      page: 0,
      size: 20,
    }))).toContain('bilan.pdf')
    expect(textOf(await call('moriarty_search_france_aides', { search: 'CIR', page: 0, size: 5 })))
      .toContain('CIR')
  })

  it('executes optional-argument tools when paging fields are omitted', async () => {
    const { call } = await mount()
    expect((await call('moriarty_list_businesses', { organizationId: 'org-1' })).isError).toBe(false)
    expect((await call('moriarty_list_capsule_files', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).isError).toBe(false)
    const untitled = await call('moriarty_search_france_aides', {})
    expect(untitled.isError).toBe(false)
    const emptySearch = await call('moriarty_search_france_aides', { search: '' })
    expect(emptySearch.isError).toBe(false)
  })

  it('surfaces a blank organizationId as a tool error', async () => {
    const { call } = await mount()
    const out = await call('moriarty_list_businesses', { organizationId: '  ' })
    expect(out.isError).toBe(true)
    expect(textOf(out)).toContain('organizationId must be a non-empty string')
  })

  it('returns a null diagnostic without inventing eligibility', async () => {
    const { call } = await mount(stubProvider({
      getLatestDiagnostic: () => Promise.resolve(null),
    }))
    const out = await call('moriarty_get_latest_diagnostic', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    })
    expect(out.isError).toBe(false)
    expect(textOf(out)).toContain('No diagnostic')
  })

  it('rejects a non-positive timeoutMs', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MoriartyRuntime)
    expect(() => ToolMoriarty.apply(ctx, { timeoutMs: 0 })).toThrow(/timeoutMs must be a positive integer/)
    expect(() => ToolMoriarty.apply(ctx, { timeoutMs: 1.5 })).toThrow(/timeoutMs must be a positive integer/)
  })

  it('presents pending calls with the organization or query in the title', async () => {
    const { ctx } = await mount()
    expect(ctx.tools.get('moriarty_list_organizations')?.presentCall?.({})).toMatchObject({
      title: 'List Moriarty organizations',
    })
    expect(ctx.tools.get('moriarty_list_businesses')?.presentCall?.({ organizationId: 'org-1' }))
      .toMatchObject({ title: 'List businesses org-1' })
    expect(ctx.tools.get('moriarty_get_business')?.presentCall?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toMatchObject({ title: 'Get business biz-1' })
    expect(ctx.tools.get('moriarty_get_latest_diagnostic')?.presentCall?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toMatchObject({ title: 'Latest diagnostic biz-1' })
    expect(ctx.tools.get('moriarty_list_capsule_files')?.presentCall?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toMatchObject({ title: 'List capsule biz-1' })
    expect(ctx.tools.get('moriarty_search_france_aides')?.presentCall?.({ search: 'CIR' }))
      .toMatchObject({ title: 'Search aides CIR' })
    expect(ctx.tools.get('moriarty_search_france_aides')?.presentCall?.({ search: '' }))
      .toMatchObject({ title: 'Search France-aides' })
    expect(ctx.tools.get('moriarty_search_france_aides')?.presentCall?.({}))
      .toMatchObject({ title: 'Search France-aides' })
    expect(ctx.tools.get('moriarty_list_organizations')?.isConcurrencySafe?.({})).toBe(true)
    expect(ctx.tools.get('moriarty_list_businesses')?.isConcurrencySafe?.({ organizationId: 'org-1' })).toBe(true)
    expect(ctx.tools.get('moriarty_get_business')?.isConcurrencySafe?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toBe(true)
    expect(ctx.tools.get('moriarty_get_latest_diagnostic')?.isConcurrencySafe?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toBe(true)
    expect(ctx.tools.get('moriarty_list_capsule_files')?.isConcurrencySafe?.({
      organizationId: 'org-1',
      businessId: 'biz-1',
    })).toBe(true)
    expect(ctx.tools.get('moriarty_search_france_aides')?.isConcurrencySafe?.({})).toBe(true)
    expect(ctx.tools.get('moriarty_list_organizations')?.timeoutMs).toBe(30_000)
  })
})
