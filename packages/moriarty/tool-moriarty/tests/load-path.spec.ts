/**
 * Real Loader-path guard for an injected namespace plugin. A default export would make
 * `unwrapExports` collapse the namespace and drop `inject`, causing access to `ctx.moriarty`
 * to fail. See postmortem 0001.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import MoriartyRuntime from '@deepseek-ai/dsh-moriarty-api'
import * as toolMoriarty from '@deepseek-ai/dsh-tool-moriarty'

describe('dsh-tool-moriarty real-load-path guard', () => {
  it('has no default export and keeps name/inject/Config through unwrapExports', () => {
    expect('default' in toolMoriarty).toBe(false)

    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolMoriarty) as Record<string, unknown>
    expect(unwrapped).toBe(toolMoriarty)
    expect(unwrapped.name).toBe('tool-moriarty')
    expect(unwrapped.inject).toEqual(['tools', 'moriarty', 'systemPrompt'])
    expect(typeof unwrapped.apply).toBe('function')
  })

  it('boots over ctx.moriarty through the unwrapped module without an inject error', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MoriartyRuntime, {})

    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(toolMoriarty) as Parameters<Context['plugin']>[0]
    const fiber = await ctx.plugin(unwrapped)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(expect.arrayContaining([
      'moriarty_list_organizations',
      'moriarty_search_france_aides',
    ]))
    await fiber.dispose()
  })
})
