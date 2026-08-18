/**
 * Integration: the real HTTP provider + the real seam + the model tools, exercised
 * through `ctx.tools.execute()` against a loopback moriarty-be stand-in.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import MoriartyRuntime from '@deepseek-ai/dsh-moriarty-api'
import * as MoriartyHttp from '@deepseek-ai/dsh-moriarty-api-http'
import * as ToolMoriarty from '@deepseek-ai/dsh-tool-moriarty'

const testToolSignal = new AbortController().signal

type Handler = (req: IncomingMessage, res: ServerResponse) => void

let server: Server
let handler: Handler
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>
let previousToken: string | undefined

beforeEach(async () => {
  handler = (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify([{ id: 'org-1', name: 'acme', displayName: 'Acme' }]))
  }
  server = createServer((req, res) => { handler(req, res) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  previousToken = process.env.MORIARTY_ACCESS_TOKEN
  process.env.MORIARTY_ACCESS_TOKEN = 'integration-tok'

  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(MoriartyRuntime)
  await ctx.plugin(MoriartyHttp, { baseURL: base })
  fiber = await ctx.plugin(ToolMoriarty)
})

afterEach(async () => {
  await fiber.dispose()
  if (previousToken === undefined) delete process.env.MORIARTY_ACCESS_TOKEN
  else process.env.MORIARTY_ACCESS_TOKEN = previousToken
  await new Promise<void>(resolve => server.close(() => { resolve() }))
})

let counter = 0
function call(name: string, args: unknown): Promise<ToolExecutionResult> {
  return ctx.tools.execute({ signal: testToolSignal, callId: CallId(`call-${++counter}`), name, arguments: args })
}

describe('moriarty tools over the real HTTP provider', () => {
  it('lists organizations from loopback JSON', async () => {
    const out = await call('moriarty_list_organizations', {})
    expect(out.isError).toBe(false)
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('Acme (org-1)')
    expect(text).toContain('GET /v1/organizations/me')
  })

  it('surfaces a missing diagnostic as a successful empty result', async () => {
    handler = (_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end('{}')
    }
    const out = await call('moriarty_get_latest_diagnostic', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    })
    expect(out.isError).toBe(false)
    expect(out.content.map(block => block.type === 'text' ? block.text : '').join(''))
      .toContain('No diagnostic')
  })

  it('surfaces MORIARTY_FORBIDDEN as a structured tool error', async () => {
    handler = (_req, res) => {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end('{}')
    }
    const out = await call('moriarty_get_business', {
      organizationId: 'org-1',
      businessId: 'biz-1',
    })
    expect(out.isError).toBe(true)
    expect(out.error?.info?.code).toBe('MORIARTY_FORBIDDEN')
  })
})
