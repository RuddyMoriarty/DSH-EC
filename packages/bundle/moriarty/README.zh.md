# `@deepseek-ai/dsh-moriarty`

[English](README.md) | 中文

Moriarty 的 profile overlay。[`cordis.patch.yml`](cordis.patch.yml) 叠在 [`dsh-base`](../base/README.md) 与 [`dsh-web-app`](../web-app/README.md) 之上：它用手工声明的 `moriarty-local` OpenAI 兼容路由唤醒 [`llm-pi-ai`](../../llm/llm-pi-ai/README.md)（5090 上 Unsloth 提供的 VL，经隧道为 `http://127.0.0.1:8000/v1`，可用 `MORIARTY_LOCAL_LLM_BASE_URL` 覆盖），把 [`agent-default-model`](../../core/agent-default-model/README.md) 指向 `moriarty-vl`，用法语事务所文本替换部署 persona 并省略 DeepSeek Harness 身份开场白，把随附的 [`agent-presets`](../../preset/agent-presets/README.md) 默认值设为 `moriarty`，并插入 `ctx.moriarty` 与 moriarty-be HTTP 提供方。该包没有运行时 API；profile 组合器通过 manifest（元数据清单）的 `dsh.bundle.patch` 字段解析 patch。

`llm-deepseek` 仍由 base 挂载。本地 serve 不可达时请求失败；本 overlay 不会回退到云端密钥。pi-ai 的 openai-completions 路径仍要求 bearer，因此该路由发送 `Authorization: Bearer local` 作为无密钥 vLLM 占位。

`moriarty` profile 模板把本组合包叠在最后。[`packages/moriarty/`](../../moriarty/README.md) 下的产品插件是独立层。

Unsloth SFT 与厂商 OpenAPI/MCP 语料是并行工作流；它们不放在本包（[Agent Note](../../../.agents/notes/proposed/architecture/2026-08-18-moriarty-unsloth-local-models.md)）。

## 模型体验

通过被补丁的行间接产生影响：本 overlay 选定 Unsloth 提供的默认模型、法语事务所 persona，以及由 `dsh-system-prompt`、`dsh-llm-pi-ai`、`dsh-tool-moriarty` 与 `moriarty` agent preset 渲染的宿主 `ctx.moriarty` 行。

#### KV Cache 影响

无直接影响；每条被补丁行的影响由其所属的包负责。

## 已知限制与暂缓事项

- **patch 会替换整行 `config`**：profile 覆盖必须重述该行需要保留的每个字段；不存在深度合并层。
- **拒绝 `Bearer local` 的服务器不是云端回退**：通过 Models 页面／`llm-pi-ai:` 设置配置真实凭据，否则请求以适配器诊断失败。
