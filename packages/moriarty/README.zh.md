# moriarty/

[English](README.md) | 中文

面向法国专家会计师的产品插件。可安装的 profile overlay 是 [`@deepseek-ai/dsh-moriarty`](../bundle/moriarty/README.md)，堆在 `dsh-base` 与 `dsh-web-app` 之后。

| 包 | 职责 | ctx key |
|---|---|---|
| [`moriarty-api/`](moriarty-api/README.md) | 定义 Moriarty REST 提供方注册、选择和共享错误 | `ctx.moriarty` |
| [`moriarty-api-http/`](moriarty-api-http/README.md) | 通过 HTTPS 调用 moriarty-be | 注册到 `ctx.moriarty` |
| [`tool-moriarty/`](tool-moriarty/README.md) | 向模型公开 Moriarty REST 读取 | 注册到 `ctx.tools` |

子系统参考见 [docs/subsystems/moriarty.md](../../docs/subsystems/moriarty.md)；依据见 [Moriarty REST 能力 Agent Note](../../.agents/notes/implemented/architecture/2026-08-18-moriarty-api-capability-seam.md)。

厂商 OpenAPI/MCP 语料与 Unsloth SFT 不放在本组。
