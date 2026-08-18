/**
 * Register the moriarty-be HTTP provider in `ctx.moriarty`. Bearer tokens come
 * from `ctx.credentials` (default `MORIARTY_ACCESS_TOKEN`); redirects fail closed.
 * @module @deepseek-ai/dsh-moriarty-api-http
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-moriarty-api'
import {
  MORIARTY_DEFAULT_BASE_URL,
  MoriartyHttpProvider,
} from './provider.ts'

export {
  isValidBaseUrl,
  MORIARTY_DEFAULT_BASE_URL,
  MORIARTY_HTTP_PROVIDER_ID,
  MoriartyHttpProvider,
} from './provider.ts'
export type { MoriartyHttpProviderOptions } from './provider.ts'
export {
  parseBusiness,
  parseBusinessPage,
  parseCapsuleFile,
  parseCapsuleFilePage,
  parseDiagnosticSummary,
  parseFranceAide,
  parseFranceAidePage,
  parseOrganization,
  parseOrganizations,
} from './parse.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'moriarty-api-http'

/** The Moriarty seam this provider registers into. */
export const inject = ['moriarty']

const DEFAULT_ACCESS_TOKEN_ENV = 'MORIARTY_ACCESS_TOKEN'
const BASE_URL_ENV = 'MORIARTY_API_BASE_URL'
const MAX_NODE_TIMER_DELAY_MS = 2_147_483_647

/** Plugin config (all optional — `apply` fills env-var and constant defaults). */
export interface Config {
  /** API origin, no trailing slash. Defaults to `https://api.themoriarty.app`. */
  baseURL?: string
  /** Credential reference resolved per request; defaults to `MORIARTY_ACCESS_TOKEN`. */
  accessTokenEnv?: string
  /** Resource-backstop timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  accessTokenEnv: z.string().role('credential-ref').default(DEFAULT_ACCESS_TOKEN_ENV),
  timeoutMs: z.number().default(30_000),
})

/**
 * Register the HTTP provider. Missing tokens fail at the next call, not at load.
 * @param ctx - plugin context supplying credentials and the Moriarty seam.
 * @param config - optional origin, credential ref, and timeout.
 */
export function apply(ctx: Context, config: Config): void {
  const timeoutMs = config.timeoutMs ?? 30_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('moriarty-api-http: timeoutMs must be a positive integer')
  }
  if (timeoutMs > MAX_NODE_TIMER_DELAY_MS) {
    throw new Error(`moriarty-api-http: timeoutMs must be no greater than ${MAX_NODE_TIMER_DELAY_MS}`)
  }
  const accessTokenEnv = credentialRef(config.accessTokenEnv ?? DEFAULT_ACCESS_TOKEN_ENV)
  const baseURL = config.baseURL
    ?? launchEnvironmentOf(ctx).get(BASE_URL_ENV)?.value
    ?? MORIARTY_DEFAULT_BASE_URL
  ctx.moriarty.registerProvider(new MoriartyHttpProvider({
    baseURL,
    timeoutMs,
    resolveAccessToken: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(accessTokenEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(accessTokenEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
  }))
}
