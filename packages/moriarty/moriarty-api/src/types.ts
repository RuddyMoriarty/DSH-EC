/**
 * Request and result types for the Moriarty REST capability (`ctx.moriarty`).
 * These are the harness's portable records, mapped from moriarty-be OpenAPI
 * DTOs at the HTTP provider — not a copy of the Spring class graph.
 * @module @deepseek-ai/dsh-moriarty-api/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import { HarnessError } from '@deepseek-ai/dsh-llm'

/** Opaque organization id from moriarty-be. */
export type OrganizationId = Branded<'MoriartyOrganizationId'>

/** Opaque business (client dossier) id from moriarty-be. */
export type BusinessId = Branded<'MoriartyBusinessId'>

/**
 * Brand a non-empty string as an {@link OrganizationId}.
 * @param id - the raw organization id.
 * @returns the branded id.
 */
export function OrganizationId(id: string): OrganizationId {
  const trimmed = id.trim()
  if (trimmed.length === 0) {
    throw new MoriartyError('organizationId must be a non-empty string', 'MORIARTY_INVALID_REQUEST')
  }
  return trimmed as OrganizationId
}

/**
 * Brand a non-empty string as a {@link BusinessId}.
 * @param id - the raw business id.
 * @returns the branded id.
 */
export function BusinessId(id: string): BusinessId {
  const trimmed = id.trim()
  if (trimmed.length === 0) {
    throw new MoriartyError('businessId must be a non-empty string', 'MORIARTY_INVALID_REQUEST')
  }
  return trimmed as BusinessId
}

/** One organization the authenticated user belongs to. */
export interface Organization {
  readonly id: OrganizationId
  readonly name: string
  readonly displayName: string
}

/** One client business in an organization. */
export interface Business {
  readonly id: BusinessId
  readonly name: string
  readonly organizationId: OrganizationId
  readonly archived: boolean
  readonly tags: readonly string[]
  readonly auditUpdatedAt: string
  readonly siret?: string
  readonly socialReason?: string
}

/** One page of business rows from `GET /v1/businesses/{organizationId}/list`. */
export interface BusinessPage {
  readonly content: readonly Business[]
  readonly totalElements: number
  readonly number: number
  readonly size: number
  readonly empty: boolean
}

/** Latest aide-eligibility diagnostic summary, or the empty case. */
export interface DiagnosticSummary {
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

/** One capsule file listing row. */
export interface CapsuleFile {
  readonly id: string
  readonly name: string
  readonly contentType: string
  readonly type: string
  readonly version: number
  readonly auditUpdatedAt: string
}

/** One page of capsule files from `GET /v1/capsule/{org}/{business}/files`. */
export interface CapsuleFilePage {
  readonly content: readonly CapsuleFile[]
  readonly totalElements: number
  readonly number: number
  readonly size: number
  readonly empty: boolean
}

/** One France-aides catalogue card (not a client eligibility verdict). */
export interface FranceAide {
  readonly id: number
  readonly nom: string
  readonly couvertureGeo: string
  readonly status: number
  readonly objet?: string
}

/** One page of France-aides search hits. */
export interface FranceAidePage {
  readonly content: readonly FranceAide[]
  readonly totalElements: number
  readonly number: number
  readonly size: number
  readonly empty: boolean
}

/** List businesses in one organization. */
export interface ListBusinessesRequest {
  readonly organizationId: OrganizationId
  readonly page?: number
  readonly size?: number
  readonly search?: string
}

/** Identify one business inside an organization. */
export interface GetBusinessRequest {
  readonly organizationId: OrganizationId
  readonly businessId: BusinessId
}

/** List capsule files for one business. */
export interface ListCapsuleFilesRequest {
  readonly organizationId: OrganizationId
  readonly businessId: BusinessId
  readonly page?: number
  readonly size?: number
}

/** Search the France-aides catalogue. */
export interface SearchFranceAidesRequest {
  readonly search?: string
  readonly page?: number
  readonly size?: number
}

/**
 * A Moriarty REST backend. `id` is unique within this capability.
 * `available()` is a cheap local check and must not make network calls.
 */
export interface MoriartyApiProvider {
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

/**
 * Typed Moriarty error with a machine-routable `code`.
 * Consumers must tolerate provider-specific codes beyond the shared set.
 */
export class MoriartyError extends HarnessError {}
