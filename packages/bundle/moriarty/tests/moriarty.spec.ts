/**
 * The bundle's substance is its patch file: the `dsh.bundle.patch` manifest
 * field must name a real, parseable patch list that restates every key each
 * targeted row owns.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('dsh-moriarty bundle', () => {
  it('declares a parseable overlay that selects the Unsloth-served local VL route', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as {
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(parsed)) throw new TypeError('moriarty patch must parse to a patch list')
    const byId = new Map<string, Record<string, unknown>>()
    const add = (entry: unknown): void => {
      if (typeof entry !== 'object' || entry === null) return
      const row = entry as { id?: unknown; insert?: unknown }
      if (typeof row.id === 'string') byId.set(row.id, entry as Record<string, unknown>)
      if (Array.isArray(row.insert)) {
        for (const child of row.insert) add(child)
      }
    }
    for (const entry of parsed) add(entry)
    expect([...byId.keys()].sort()).toEqual([
      'agent-default-model', 'agent-presets', 'llm-pi-ai', 'moriarty-api', 'moriarty-api-http', 'system-prompt',
    ])

    const llm = byId.get('llm-pi-ai')?.config as {
      providers?: { 'moriarty-local'?: Record<string, unknown> }
    } | undefined
    const route = llm?.providers?.['moriarty-local']
    expect(route?.api).toBe('openai-completions')
    expect(route?.baseURL).toEqual({
      __jsExpr: "process.env.MORIARTY_LOCAL_LLM_BASE_URL || 'http://127.0.0.1:8000/v1'",
    })
    expect(route?.defaultInput).toEqual(['text', 'image'])
    expect(route?.headers).toEqual({ Authorization: 'Bearer local' })
    expect(route?.models).toEqual([
      {
        id: 'moriarty-vl',
        name: 'Moriarty VL',
        contextWindow: 32768,
        maxTokens: 4096,
        input: ['text', 'image'],
      },
    ])

    expect(byId.get('agent-default-model')?.config).toEqual({
      provider: 'moriarty-local',
      model: 'moriarty-vl',
    })
    expect(byId.get('agent-presets')?.config).toEqual({ default: 'moriarty' })
    expect(byId.get('moriarty-api')).toMatchObject({
      name: '@deepseek-ai/dsh-moriarty-api',
      config: { provider: 'moriarty-http' },
    })
    expect(byId.get('moriarty-api-http')).toMatchObject({
      name: '@deepseek-ai/dsh-moriarty-api-http',
      config: {
        baseURL: { __jsExpr: "process.env.MORIARTY_API_BASE_URL || 'https://api.themoriarty.app'" },
        accessTokenEnv: 'MORIARTY_ACCESS_TOKEN',
      },
    })
    const prompt = byId.get('system-prompt')?.config as {
      includeHarnessIdentity?: boolean
      persona?: string
    } | undefined
    expect(prompt?.includeHarnessIdentity).toBe(false)
    expect(prompt?.persona).toContain('expertise comptable')
  })
})
