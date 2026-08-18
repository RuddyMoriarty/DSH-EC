import { describe, expect, it } from 'vitest'
import { MoriartyError } from '@deepseek-ai/dsh-moriarty-api'
import {
  parseBusiness,
  parseBusinessPage,
  parseCapsuleFile,
  parseCapsuleFilePage,
  parseDiagnosticSummary,
  parseFranceAide,
  parseFranceAidePage,
  parseOrganization,
  parseOrganizations,
} from '@deepseek-ai/dsh-moriarty-api-http'

function expectInvalid(run: () => unknown): void {
  expect(run).toThrow(expect.objectContaining({ code: 'MORIARTY_INVALID_RESPONSE' }))
}

describe('organization parsing', () => {
  it('maps a full array', () => {
    expect(parseOrganizations([{ id: 'org-1', name: 'acme', displayName: 'Acme' }])).toEqual([
      { id: 'org-1', name: 'acme', displayName: 'Acme' },
    ])
  })

  it('rejects a non-array body', () => {
    expectInvalid(() => parseOrganizations({}))
  })

  it('rejects a non-object row', () => {
    expectInvalid(() => parseOrganization(null))
    expectInvalid(() => parseOrganization([]))
    expectInvalid(() => parseOrganization('org'))
  })

  it('rejects missing required strings', () => {
    expectInvalid(() => parseOrganization({ name: 'acme', displayName: 'Acme' }))
    expectInvalid(() => parseOrganization({ id: '', name: 'acme', displayName: 'Acme' }))
    expectInvalid(() => parseOrganization({ id: 1, name: 'acme', displayName: 'Acme' }))
  })
})

describe('business parsing', () => {
  const row = {
    id: 'biz-1',
    name: 'Client',
    organizationId: 'org-1',
    archived: false,
    tags: ['a'],
    auditUpdatedAt: '2026-01-01T00:00:00Z',
    siret: '123',
    socialReason: 'SARL Client',
  }

  it('maps required and optional fields', () => {
    expect(parseBusiness(row)).toEqual(row)
  })

  it('omits absent optional strings and defaults missing tags', () => {
    const { siret: _siret, socialReason: _social, tags: _tags, ...required } = row
    expect(parseBusiness(required)).toEqual({ ...required, tags: [] })
    expect(parseBusiness({ ...required, siret: null, socialReason: null, tags: null })).toEqual({
      ...required,
      tags: [],
    })
  })

  it('maps a page and defaults missing paging fields', () => {
    expect(parseBusinessPage({ content: [row] })).toEqual({
      content: [row],
      totalElements: 1,
      number: 0,
      size: 1,
      empty: false,
    })
    expect(parseBusinessPage({
      content: [],
      totalElements: 0,
      number: 2,
      size: 10,
      empty: true,
    })).toEqual({
      content: [],
      totalElements: 0,
      number: 2,
      size: 10,
      empty: true,
    })
  })

  it('rejects a page without a content array', () => {
    expectInvalid(() => parseBusinessPage({}))
    expectInvalid(() => parseBusinessPage({ content: {} }))
  })

  it('rejects malformed optional fields and tags', () => {
    expectInvalid(() => parseBusiness({ ...row, archived: 'no' }))
    expectInvalid(() => parseBusiness({ ...row, siret: 1 }))
    expectInvalid(() => parseBusiness({ ...row, tags: ['a', 1] }))
    expectInvalid(() => parseBusinessPage({ content: [], empty: 'yes' }))
    expectInvalid(() => parseBusinessPage({ content: [], totalElements: '1' }))
  })
})

describe('diagnostic parsing', () => {
  const row = {
    id: 'diag-1',
    businessId: 'biz-1',
    businessName: 'Client',
    status: 'DONE',
    diagnosticType: 'AIDES',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-02T00:00:00Z',
    totalEligible: 3,
    errorMessage: 'none',
  }

  it('maps required and optional fields', () => {
    expect(parseDiagnosticSummary(row)).toEqual(row)
  })

  it('omits absent optional fields', () => {
    const { completedAt: _c, totalEligible: _t, errorMessage: _e, ...required } = row
    expect(parseDiagnosticSummary(required)).toEqual(required)
  })

  it('rejects a non-finite totalEligible', () => {
    expectInvalid(() => parseDiagnosticSummary({ ...row, totalEligible: Number.NaN }))
    expectInvalid(() => parseDiagnosticSummary({ ...row, totalEligible: '3' }))
  })
})

describe('capsule file parsing', () => {
  const file = {
    id: 'file-1',
    name: 'bilan.pdf',
    contentType: 'application/pdf',
    type: 'DOCUMENT',
    version: 1,
    auditUpdatedAt: '2026-01-01T00:00:00Z',
  }

  it('maps a file and a page', () => {
    expect(parseCapsuleFile(file)).toEqual(file)
    expect(parseCapsuleFilePage({ content: [file] }).content).toEqual([file])
  })

  it('rejects a page without a content array', () => {
    expectInvalid(() => parseCapsuleFilePage({ content: null }))
  })

  it('rejects a non-finite version', () => {
    expectInvalid(() => parseCapsuleFile({ ...file, version: Number.POSITIVE_INFINITY }))
  })
})

describe('france-aides parsing', () => {
  const aide = {
    id: 42,
    nom: 'CIR',
    couvertureGeo: 'FR',
    status: 1,
    objet: 'innovation',
  }

  it('maps an aide and a page', () => {
    expect(parseFranceAide(aide)).toEqual(aide)
    expect(parseFranceAide({ id: 42, nom: 'CIR', couvertureGeo: 'FR', status: 1 })).toEqual({
      id: 42,
      nom: 'CIR',
      couvertureGeo: 'FR',
      status: 1,
    })
    expect(parseFranceAidePage({ content: [aide] }).empty).toBe(false)
  })

  it('rejects a page without a content array', () => {
    expectInvalid(() => parseFranceAidePage('nope'))
    expectInvalid(() => parseFranceAidePage({ content: 'nope' }))
  })

  it('rejects a non-number id', () => {
    expectInvalid(() => parseFranceAide({ ...aide, id: '42' }))
  })
})

describe('MoriartyError from parsers', () => {
  it('is thrown for invalid JSON bodies', () => {
    try {
      parseOrganizations(1)
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(MoriartyError)
    }
  })
})
