# `@deepseek-ai/dsh-moriarty`

English | [中文](README.zh.md)

The Moriarty profile overlay. [`cordis.patch.yml`](cordis.patch.yml) rides over [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md): it wakes [`llm-pi-ai`](../../llm/llm-pi-ai/README.md) with the hand-declared `moriarty-local` OpenAI-compatible route (Unsloth-served VL on the 5090, tunneled as `http://127.0.0.1:8000/v1`, overridable with `MORIARTY_LOCAL_LLM_BASE_URL`), points [`agent-default-model`](../../core/agent-default-model/README.md) at `moriarty-vl`, replaces the deployment persona with a French cabinet text and omits the DeepSeek Harness identity opener, sets the shipped [`agent-presets`](../../preset/agent-presets/README.md) default to `moriarty`, and inserts `ctx.moriarty` plus the moriarty-be HTTP provider. The package has no runtime API; the profile composer resolves the patch through the `dsh.bundle.patch` manifest field.

`llm-deepseek` stays mounted from base. An unreachable local serve fails the request; this overlay does not fall back to a cloud key. pi-ai's openai-completions path still requires a bearer, so the route sends `Authorization: Bearer local` as the keyless-vLLM placeholder.

The `moriarty` profile template stacks this bundle last. Product plugins under [`packages/moriarty/`](../../moriarty/README.md) are separate layers.

Unsloth SFT and vendor OpenAPI/MCP corpora are a parallel workstream; they do not live in this package ([Agent Note](../../../.agents/notes/proposed/architecture/2026-08-18-moriarty-unsloth-local-models.md)).

## Model Experience

Indirectly, through the patched rows: this overlay selects the Unsloth-served default model, the French cabinet persona, and the host `ctx.moriarty` rows that `dsh-system-prompt`, `dsh-llm-pi-ai`, `dsh-tool-moriarty`, and the `moriarty` agent preset render.

#### KV Cache effect

None directly; each patched row's package owns its effect.

## Known Limitations and Deferred Work

- **A patch replaces whole row configs** — profile overrides must restate every field a row keeps; there is no deep-merge layer.
- **A server that rejects `Bearer local` is not a cloud fallback** — configure a real credential through the Models page / `llm-pi-ai:` settings, or the request fails with the adapter diagnostic.
