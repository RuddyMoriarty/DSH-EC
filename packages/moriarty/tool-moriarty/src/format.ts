/**
 * Model-facing formatting and argument checks for Moriarty REST tools.
 * @module @deepseek-ai/dsh-tool-moriarty/format
 */

import type {
  Business,
  BusinessPage,
  CapsuleFile,
  CapsuleFilePage,
  DiagnosticSummary,
  FranceAide,
  FranceAidePage,
  Organization,
} from '@deepseek-ai/dsh-moriarty-api'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

/** Unbranded organization row accepted by both the seam and the tool schema. */
export interface OrganizationView {
  readonly id: string
  readonly name: string
  readonly displayName: string
}

/** Unbranded business row accepted by both the seam and the tool schema. */
export interface BusinessView {
  readonly id: string
  readonly name: string
  readonly organizationId: string
  readonly archived: boolean
  readonly tags: readonly string[]
  readonly auditUpdatedAt: string
  readonly siret?: string
  readonly socialReason?: string
}

/** Unbranded Spring-style page wrapper. */
export interface PageView<T> {
  readonly content: readonly T[]
  readonly totalElements: number
  readonly number: number
  readonly size: number
  readonly empty: boolean
}

/** Unbranded diagnostic row. */
export interface DiagnosticView {
  readonly id: string
  readonly businessId: string
  readonly businessName: string
  readonly status: string
  readonly diagnosticType: string
  readonly startedAt: string
  readonly completedAt?: string
  readonly totalEligible?: number
  readonly errorMessage?: string
}

/** Unbranded capsule file row. */
export interface CapsuleFileView {
  readonly id: string
  readonly name: string
  readonly contentType: string
  readonly type: string
  readonly version: number
  readonly auditUpdatedAt: string
}

/** Unbranded France-aides catalogue card. */
export interface FranceAideView {
  readonly id: number
  readonly nom: string
  readonly couvertureGeo: string
  readonly status: number
  readonly objet?: string
}

/**
 * Reject blank strings the schema DSL cannot express.
 * @param value - raw argument.
 * @param field - field name used in the error.
 * @returns the trimmed string.
 */
export function parseRequiredString(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new Error(`${field} must be a non-empty string`)
  return trimmed
}

/**
 * Project a seam organization into the mutable JSON tool output.
 * @param organization - one organization from `ctx.moriarty`.
 * @returns `{ id, name, displayName }` with unbranded ids.
 */
export function projectOrganization(organization: Organization): {
  id: string
  name: string
  displayName: string
} {
  return {
    id: organization.id,
    name: organization.name,
    displayName: organization.displayName,
  }
}

/**
 * Project a seam business into the mutable JSON tool output.
 * @param business - one business from `ctx.moriarty`.
 * @returns the schema row with a copied `tags` array and omitted absent optionals.
 */
export function projectBusiness(business: Business): {
  id: string
  name: string
  organizationId: string
  archived: boolean
  tags: string[]
  auditUpdatedAt: string
  siret?: string
  socialReason?: string
} {
  return {
    id: business.id,
    name: business.name,
    organizationId: business.organizationId,
    archived: business.archived,
    tags: [...business.tags],
    auditUpdatedAt: business.auditUpdatedAt,
    ...business.siret !== undefined ? { siret: business.siret } : {},
    ...business.socialReason !== undefined ? { socialReason: business.socialReason } : {},
  }
}

/**
 * Project a seam business page into the mutable JSON tool output.
 * @param page - one page from `ctx.moriarty`.
 * @returns the schema page with copied `content`.
 */
export function projectBusinessPage(page: BusinessPage): {
  content: ReturnType<typeof projectBusiness>[]
  totalElements: number
  number: number
  size: number
  empty: boolean
} {
  return {
    content: page.content.map(projectBusiness),
    totalElements: page.totalElements,
    number: page.number,
    size: page.size,
    empty: page.empty,
  }
}

/**
 * Project a seam diagnostic into the mutable JSON tool output.
 * @param diagnostic - one diagnostic from `ctx.moriarty`.
 * @returns the schema row with omitted absent optionals.
 */
export function projectDiagnostic(diagnostic: DiagnosticSummary): {
  id: string
  businessId: string
  businessName: string
  status: string
  diagnosticType: string
  startedAt: string
  completedAt?: string
  totalEligible?: number
  errorMessage?: string
} {
  return {
    id: diagnostic.id,
    businessId: diagnostic.businessId,
    businessName: diagnostic.businessName,
    status: diagnostic.status,
    diagnosticType: diagnostic.diagnosticType,
    startedAt: diagnostic.startedAt,
    ...diagnostic.completedAt !== undefined ? { completedAt: diagnostic.completedAt } : {},
    ...diagnostic.totalEligible !== undefined ? { totalEligible: diagnostic.totalEligible } : {},
    ...diagnostic.errorMessage !== undefined ? { errorMessage: diagnostic.errorMessage } : {},
  }
}

/**
 * Project a seam capsule file into the mutable JSON tool output.
 * @param file - one file from `ctx.moriarty`.
 * @returns the schema row.
 */
export function projectCapsuleFile(file: CapsuleFile): {
  id: string
  name: string
  contentType: string
  type: string
  version: number
  auditUpdatedAt: string
} {
  return {
    id: file.id,
    name: file.name,
    contentType: file.contentType,
    type: file.type,
    version: file.version,
    auditUpdatedAt: file.auditUpdatedAt,
  }
}

/**
 * Project a seam capsule page into the mutable JSON tool output.
 * @param page - one page from `ctx.moriarty`.
 * @returns the schema page with copied `content`.
 */
export function projectCapsuleFilePage(page: CapsuleFilePage): {
  content: ReturnType<typeof projectCapsuleFile>[]
  totalElements: number
  number: number
  size: number
  empty: boolean
} {
  return {
    content: page.content.map(projectCapsuleFile),
    totalElements: page.totalElements,
    number: page.number,
    size: page.size,
    empty: page.empty,
  }
}

/**
 * Project a seam France-aides card into the mutable JSON tool output.
 * @param aide - one catalogue card from `ctx.moriarty`.
 * @returns the schema row with omitted absent optionals.
 */
export function projectFranceAide(aide: FranceAide): {
  id: number
  nom: string
  couvertureGeo: string
  status: number
  objet?: string
} {
  return {
    id: aide.id,
    nom: aide.nom,
    couvertureGeo: aide.couvertureGeo,
    status: aide.status,
    ...aide.objet !== undefined ? { objet: aide.objet } : {},
  }
}

/**
 * Project a seam France-aides page into the mutable JSON tool output.
 * @param page - one page from `ctx.moriarty`.
 * @returns the schema page with copied `content`.
 */
export function projectFranceAidePage(page: FranceAidePage): {
  content: ReturnType<typeof projectFranceAide>[]
  totalElements: number
  number: number
  size: number
  empty: boolean
} {
  return {
    content: page.content.map(projectFranceAide),
    totalElements: page.totalElements,
    number: page.number,
    size: page.size,
    empty: page.empty,
  }
}

/**
 * Format organizations as a markdown list with the owning endpoint.
 * @param organizations - organizations from `ctx.moriarty` or the tool output.
 * @returns markdown list plus the owning endpoint.
 */
export function formatOrganizations(organizations: readonly OrganizationView[]): string {
  if (organizations.length === 0) {
    return 'No organizations.\n\nSource: GET /v1/organizations/me'
  }
  const lines = organizations.map(org => `- ${org.displayName} (${org.id})`)
  return `${lines.join('\n')}\n\nSource: GET /v1/organizations/me`
}

/**
 * Format a business page as a markdown list with the owning endpoint.
 * @param page - business page from `ctx.moriarty` or the tool output.
 * @param organizationId - organization used in the request (for the source line).
 * @returns markdown list plus the owning endpoint.
 */
export function formatBusinessPage(page: PageView<BusinessView>, organizationId: string): string {
  const source = `Source: GET /v1/businesses/${organizationId}/list`
  if (page.empty || page.content.length === 0) {
    return `No businesses for this organization.\n\n${source}`
  }
  const lines = page.content.map((row) => {
    const siret = row.siret !== undefined ? `, SIRET ${row.siret}` : ''
    return `- ${row.name} (${row.id}${siret})`
  })
  return `${lines.join('\n')}\n\n${source}`
}

/**
 * Format one business as markdown details with the owning endpoint.
 * @param business - one business record.
 * @returns markdown details plus the owning endpoint.
 */
export function formatBusiness(business: BusinessView): string {
  const siret = business.siret !== undefined ? `\nSIRET: ${business.siret}` : ''
  return `${business.name} (${business.id})${siret}\n\nSource: GET /v1/businesses/${business.organizationId}/${business.id}`
}

/**
 * Format the latest diagnostic, or the empty case, with the owning endpoint.
 * @param diagnostic - latest diagnostic, or `null` when none exists.
 * @param organizationId - organization used in the request.
 * @param businessId - business used in the request.
 * @returns markdown summary plus the owning endpoint.
 */
export function formatDiagnostic(
  diagnostic: DiagnosticView | null,
  organizationId: string,
  businessId: string,
): string {
  const source = `Source: GET /v1/businesses/${organizationId}/${businessId}/diagnostics/latest`
  if (diagnostic === null) {
    return `No diagnostic for this business.\n\n${source}`
  }
  const eligible = diagnostic.totalEligible !== undefined ? `, eligible ${diagnostic.totalEligible}` : ''
  return `${diagnostic.businessName}: ${diagnostic.status} (${diagnostic.diagnosticType}${eligible})\n\n${source}`
}

/**
 * Format a capsule file page as a markdown list with the owning endpoint.
 * @param page - capsule file page.
 * @param organizationId - organization used in the request.
 * @param businessId - business used in the request.
 * @returns markdown list plus the owning endpoint.
 */
export function formatCapsuleFilePage(
  page: PageView<CapsuleFileView>,
  organizationId: string,
  businessId: string,
): string {
  const source = `Source: GET /v1/capsule/${organizationId}/${businessId}/files`
  if (page.empty || page.content.length === 0) {
    return `No capsule files for this business.\n\n${source}`
  }
  const lines = page.content.map(row => `- ${row.name} (${row.id}, ${row.type})`)
  return `${lines.join('\n')}\n\n${source}`
}

/**
 * Format a France-aides page as a markdown list. Catalogue hits are not eligibility.
 * @param page - France-aides page.
 * @returns markdown list plus the owning endpoint. Catalogue hits are not eligibility.
 */
export function formatFranceAidePage(page: PageView<FranceAideView>): string {
  const source = 'Source: GET /v1/france-aides'
  const note = 'A catalogue hit is not a client eligibility verdict.'
  if (page.empty || page.content.length === 0) {
    return `No aides matched.\n\n${note}\n\n${source}`
  }
  const lines = page.content.map(row => `- ${row.nom} (id ${row.id}, ${row.couvertureGeo})`)
  return `${lines.join('\n')}\n\n${note}\n\n${source}`
}

/**
 * Pending generic card for a Moriarty REST tool.
 * @param title - short call title.
 * @returns the generic pending card.
 */
export function presentMoriartyCall(title: string): GenericCallView {
  return { card: 'generic', title, kind: 'search' }
}
