/**
 * Wire-boundary parsers for moriarty-be JSON. HTTP is not a typed same-process
 * call, so required fields are checked here before they become harness records.
 * @module @deepseek-ai/dsh-moriarty-api-http/parse
 */

import {
  BusinessId,
  MoriartyError,
  OrganizationId,
  type Business,
  type BusinessPage,
  type CapsuleFile,
  type CapsuleFilePage,
  type DiagnosticSummary,
  type FranceAide,
  type FranceAidePage,
  type Organization,
} from '@deepseek-ai/dsh-moriarty-api'

/**
 * Parse `GET /v1/organizations/me` (an array of organization objects).
 * @param value - decoded JSON body.
 * @returns the organizations.
 */
export function parseOrganizations(value: unknown): readonly Organization[] {
  if (!Array.isArray(value)) {
    throw new MoriartyError('organizations response must be a JSON array', 'MORIARTY_INVALID_RESPONSE')
  }
  return value.map(parseOrganization)
}

/**
 * Parse one organization object.
 * @param value - one array element.
 * @returns the organization.
 */
export function parseOrganization(value: unknown): Organization {
  const row = asObject(value, 'organization')
  return {
    id: OrganizationId(requiredString(row, 'id')),
    name: requiredString(row, 'name'),
    displayName: requiredString(row, 'displayName'),
  }
}

/**
 * Parse a Spring `PageBusinessShortDto`.
 * @param value - decoded JSON body.
 * @returns the business page.
 */
export function parseBusinessPage(value: unknown): BusinessPage {
  const row = asObject(value, 'business page')
  const contentValue = row['content']
  if (!Array.isArray(contentValue)) {
    throw new MoriartyError('business page content must be a JSON array', 'MORIARTY_INVALID_RESPONSE')
  }
  const content = contentValue.map(parseBusiness)
  return {
    content,
    totalElements: optionalNumber(row, 'totalElements') ?? content.length,
    number: optionalNumber(row, 'number') ?? 0,
    size: optionalNumber(row, 'size') ?? content.length,
    empty: optionalBoolean(row, 'empty') ?? content.length === 0,
  }
}

/**
 * Parse one `BusinessShortDto`.
 * @param value - one page element.
 * @returns the business.
 */
export function parseBusiness(value: unknown): Business {
  const row = asObject(value, 'business')
  const siret = optionalString(row, 'siret')
  const socialReason = optionalString(row, 'socialReason')
  return {
    id: BusinessId(requiredString(row, 'id')),
    name: requiredString(row, 'name'),
    organizationId: OrganizationId(requiredString(row, 'organizationId')),
    archived: requiredBoolean(row, 'archived'),
    tags: parseStringArray(row['tags'], 'tags'),
    auditUpdatedAt: requiredString(row, 'auditUpdatedAt'),
    ...siret !== undefined ? { siret } : {},
    ...socialReason !== undefined ? { socialReason } : {},
  }
}

/**
 * Parse a `DiagnosticSummaryDto`. HTTP 404 is handled by the provider, not here.
 * @param value - decoded JSON body.
 * @returns the diagnostic summary.
 */
export function parseDiagnosticSummary(value: unknown): DiagnosticSummary {
  const row = asObject(value, 'diagnostic')
  const completedAt = optionalString(row, 'completedAt')
  const totalEligible = optionalNumber(row, 'totalEligible')
  const errorMessage = optionalString(row, 'errorMessage')
  return {
    id: requiredString(row, 'id'),
    businessId: BusinessId(requiredString(row, 'businessId')),
    businessName: requiredString(row, 'businessName'),
    status: requiredString(row, 'status'),
    diagnosticType: requiredString(row, 'diagnosticType'),
    startedAt: requiredString(row, 'startedAt'),
    ...completedAt !== undefined ? { completedAt } : {},
    ...totalEligible !== undefined ? { totalEligible } : {},
    ...errorMessage !== undefined ? { errorMessage } : {},
  }
}

/**
 * Parse a Spring `PageCapsuleFileDto`.
 * @param value - decoded JSON body.
 * @returns the file page.
 */
export function parseCapsuleFilePage(value: unknown): CapsuleFilePage {
  const row = asObject(value, 'capsule file page')
  const contentValue = row['content']
  if (!Array.isArray(contentValue)) {
    throw new MoriartyError('capsule file page content must be a JSON array', 'MORIARTY_INVALID_RESPONSE')
  }
  const content = contentValue.map(parseCapsuleFile)
  return {
    content,
    totalElements: optionalNumber(row, 'totalElements') ?? content.length,
    number: optionalNumber(row, 'number') ?? 0,
    size: optionalNumber(row, 'size') ?? content.length,
    empty: optionalBoolean(row, 'empty') ?? content.length === 0,
  }
}

/**
 * Parse one `CapsuleFileDto`.
 * @param value - one page element.
 * @returns the file row.
 */
export function parseCapsuleFile(value: unknown): CapsuleFile {
  const row = asObject(value, 'capsule file')
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    contentType: requiredString(row, 'contentType'),
    type: requiredString(row, 'type'),
    version: requiredNumber(row, 'version'),
    auditUpdatedAt: requiredString(row, 'auditUpdatedAt'),
  }
}

/**
 * Parse a Spring `PageFranceAideDto`.
 * @param value - decoded JSON body.
 * @returns the aides page.
 */
export function parseFranceAidePage(value: unknown): FranceAidePage {
  const row = asObject(value, 'france-aides page')
  const contentValue = row['content']
  if (!Array.isArray(contentValue)) {
    throw new MoriartyError('france-aides page content must be a JSON array', 'MORIARTY_INVALID_RESPONSE')
  }
  const content = contentValue.map(parseFranceAide)
  return {
    content,
    totalElements: optionalNumber(row, 'totalElements') ?? content.length,
    number: optionalNumber(row, 'number') ?? 0,
    size: optionalNumber(row, 'size') ?? content.length,
    empty: optionalBoolean(row, 'empty') ?? content.length === 0,
  }
}

/**
 * Parse one `FranceAideDto`.
 * @param value - one page element.
 * @returns the aide card.
 */
export function parseFranceAide(value: unknown): FranceAide {
  const row = asObject(value, 'france-aide')
  const objet = optionalString(row, 'objet')
  return {
    id: requiredNumber(row, 'id'),
    nom: requiredString(row, 'nom'),
    couvertureGeo: requiredString(row, 'couvertureGeo'),
    status: requiredNumber(row, 'status'),
    ...objet !== undefined ? { objet } : {},
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MoriartyError(`${label} must be a JSON object`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value as Record<string, unknown>
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new MoriartyError(`${key} must be a non-empty string`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function optionalString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new MoriartyError(`${key} must be a string when present`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function requiredBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key]
  if (typeof value !== 'boolean') {
    throw new MoriartyError(`${key} must be a boolean`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function optionalBoolean(row: Record<string, unknown>, key: string): boolean | undefined {
  const value = row[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') {
    throw new MoriartyError(`${key} must be a boolean when present`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MoriartyError(`${key} must be a finite number`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function optionalNumber(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MoriartyError(`${key} must be a finite number when present`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}

function parseStringArray(value: unknown, key: string): readonly string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new MoriartyError(`${key} must be an array of strings`, 'MORIARTY_INVALID_RESPONSE')
  }
  return value
}
