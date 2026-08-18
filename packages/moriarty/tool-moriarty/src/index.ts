/**
 * Model-facing Moriarty REST tools over `ctx.moriarty`. This package owns
 * schemas, validation, prompt guidance, and presentation, never HTTP.
 * @module @deepseek-ai/dsh-tool-moriarty
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { BusinessId, OrganizationId } from '@deepseek-ai/dsh-moriarty-api'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
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
  projectBusinessPage,
  projectCapsuleFilePage,
  projectDiagnostic,
  projectFranceAidePage,
  projectOrganization,
} from './format.ts'

export {
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
} from './format.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-moriarty'

/** Services required by the Moriarty tool suite. */
export const inject = ['tools', 'moriarty', 'systemPrompt']

/** Default cooperative tool-call timeout budget (ms). */
export const DEFAULT_MORIARTY_TOOL_TIMEOUT_MS = 30_000

/** Plugin config: per-tool budgets. */
export interface Config {
  /** Cooperative timeout budget (ms) for every Moriarty tool. Defaults to 30000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  timeoutMs: z.number().default(DEFAULT_MORIARTY_TOOL_TIMEOUT_MS),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

/**
 * Register the Moriarty REST tools and their system-prompt guidance.
 * @param ctx - plugin context whose `tools` and `systemPrompt` receive the registrations.
 * @param config - optional timeout budget.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (!Number.isInteger(resolved.timeoutMs) || resolved.timeoutMs < 1) {
    throw new Error('tool-moriarty: timeoutMs must be a positive integer')
  }
  const timeoutMs = resolved.timeoutMs

  ctx.systemPrompt.section({
    name: 'tool:moriarty',
    order: 120,
    text: 'Use the Moriarty REST tools for the current cabinet organization, its businesses, capsule files, diagnostics, and the France-aides catalogue. Cite the tool and endpoint in every figure or eligibility claim. A successful tool call is not a completed engagement. A France-aides catalogue hit is not a client eligibility verdict.',
  })

  ctx.tools.register(defineTool({
    name: 'moriarty_list_organizations',
    description: 'List organizations the current Moriarty token can access. Source: GET /v1/organizations/me.',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            displayName: { type: 'string', required: true },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatOrganizations(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      return (await ctx.moriarty.listOrganizations(exec.signal)).map(projectOrganization)
    },
    presentCall: () => presentMoriartyCall('List Moriarty organizations'),
  }))

  ctx.tools.register(defineTool({
    name: 'moriarty_list_businesses',
    description: 'List client businesses in one organization. Source: GET /v1/businesses/{organizationId}/list. Do not invent clients.',
    parameters: {
      organizationId: { type: 'string', required: true, description: 'Organization id from moriarty_list_organizations.' },
      page: { type: 'number', description: 'Zero-based page index.' },
      size: { type: 'number', description: 'Page size.' },
      search: { type: 'string', description: 'Optional name search.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
                organizationId: { type: 'string', required: true },
                archived: { type: 'boolean', required: true },
                tags: { type: 'array', required: true, items: { type: 'string' } },
                auditUpdatedAt: { type: 'string', required: true },
                siret: { type: 'string' },
                socialReason: { type: 'string' },
              },
            },
          },
          totalElements: { type: 'number', required: true },
          number: { type: 'number', required: true },
          size: { type: 'number', required: true },
          empty: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{ type: 'text', text: formatBusinessPage(value, args.organizationId) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const organizationId = OrganizationId(parseRequiredString(args.organizationId, 'organizationId'))
      return projectBusinessPage(await ctx.moriarty.listBusinesses({
        organizationId,
        ...args.page !== undefined ? { page: args.page } : {},
        ...args.size !== undefined ? { size: args.size } : {},
        ...args.search !== undefined ? { search: args.search } : {},
      }, exec.signal))
    },
    presentCall: args => presentMoriartyCall(`List businesses ${args.organizationId}`),
  }))

  ctx.tools.register(defineTool({
    name: 'moriarty_get_business',
    description: 'Load one client business. Source: GET /v1/businesses/{organizationId}/{businessId}.',
    parameters: {
      organizationId: { type: 'string', required: true, description: 'Organization id.' },
      businessId: { type: 'string', required: true, description: 'Business id.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          organizationId: { type: 'string', required: true },
          archived: { type: 'boolean', required: true },
          tags: { type: 'array', required: true, items: { type: 'string' } },
          auditUpdatedAt: { type: 'string', required: true },
          siret: { type: 'string' },
          socialReason: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatBusiness(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return projectBusiness(await ctx.moriarty.getBusiness({
        organizationId: OrganizationId(parseRequiredString(args.organizationId, 'organizationId')),
        businessId: BusinessId(parseRequiredString(args.businessId, 'businessId')),
      }, exec.signal))
    },
    presentCall: args => presentMoriartyCall(`Get business ${args.businessId}`),
  }))

  ctx.tools.register(defineTool({
    name: 'moriarty_get_latest_diagnostic',
    description: 'Get the latest aide-eligibility diagnostic for a business, or report that none exists. Source: GET .../diagnostics/latest. Do not invent eligibility.',
    parameters: {
      organizationId: { type: 'string', required: true, description: 'Organization id.' },
      businessId: { type: 'string', required: true, description: 'Business id.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          diagnostic: {
            required: true,
            oneOf: [
              { type: 'null' },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true },
                  businessId: { type: 'string', required: true },
                  businessName: { type: 'string', required: true },
                  status: { type: 'string', required: true },
                  diagnosticType: { type: 'string', required: true },
                  startedAt: { type: 'string', required: true },
                  completedAt: { type: 'string' },
                  totalEligible: { type: 'number' },
                  errorMessage: { type: 'string' },
                },
              },
            ],
          },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: formatDiagnostic(value.diagnostic, args.organizationId, args.businessId),
      }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const organizationId = parseRequiredString(args.organizationId, 'organizationId')
      const businessId = parseRequiredString(args.businessId, 'businessId')
      const diagnostic = await ctx.moriarty.getLatestDiagnostic({
        organizationId: OrganizationId(organizationId),
        businessId: BusinessId(businessId),
      }, exec.signal)
      return { diagnostic: diagnostic === null ? null : projectDiagnostic(diagnostic) }
    },
    presentCall: args => presentMoriartyCall(`Latest diagnostic ${args.businessId}`),
  }))

  ctx.tools.register(defineTool({
    name: 'moriarty_list_capsule_files',
    description: 'List files in a business capsule. Source: GET /v1/capsule/{organizationId}/{businessId}/files.',
    parameters: {
      organizationId: { type: 'string', required: true, description: 'Organization id.' },
      businessId: { type: 'string', required: true, description: 'Business id.' },
      page: { type: 'number', description: 'Zero-based page index.' },
      size: { type: 'number', description: 'Page size.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
                contentType: { type: 'string', required: true },
                type: { type: 'string', required: true },
                version: { type: 'number', required: true },
                auditUpdatedAt: { type: 'string', required: true },
              },
            },
          },
          totalElements: { type: 'number', required: true },
          number: { type: 'number', required: true },
          size: { type: 'number', required: true },
          empty: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: formatCapsuleFilePage(value, args.organizationId, args.businessId),
      }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return projectCapsuleFilePage(await ctx.moriarty.listCapsuleFiles({
        organizationId: OrganizationId(parseRequiredString(args.organizationId, 'organizationId')),
        businessId: BusinessId(parseRequiredString(args.businessId, 'businessId')),
        ...args.page !== undefined ? { page: args.page } : {},
        ...args.size !== undefined ? { size: args.size } : {},
      }, exec.signal))
    },
    presentCall: args => presentMoriartyCall(`List capsule ${args.businessId}`),
  }))

  ctx.tools.register(defineTool({
    name: 'moriarty_search_france_aides',
    description: 'Search the France-aides catalogue. A hit is not a client eligibility verdict. Source: GET /v1/france-aides.',
    parameters: {
      search: { type: 'string', description: 'Full-text search query.' },
      page: { type: 'number', description: 'Zero-based page index.' },
      size: { type: 'number', description: 'Page size.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'number', required: true },
                nom: { type: 'string', required: true },
                couvertureGeo: { type: 'string', required: true },
                status: { type: 'number', required: true },
                objet: { type: 'string' },
              },
            },
          },
          totalElements: { type: 'number', required: true },
          number: { type: 'number', required: true },
          size: { type: 'number', required: true },
          empty: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatFranceAidePage(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return projectFranceAidePage(await ctx.moriarty.searchFranceAides({
        ...args.search !== undefined ? { search: args.search } : {},
        ...args.page !== undefined ? { page: args.page } : {},
        ...args.size !== undefined ? { size: args.size } : {},
      }, exec.signal))
    },
    presentCall: args => presentMoriartyCall(args.search !== undefined && args.search.length > 0
      ? `Search aides ${args.search}`
      : 'Search France-aides'),
  }))
}
