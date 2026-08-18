# moriarty/

English | [中文](README.zh.md)

French expertise-comptable product plugins. The installable profile overlay is [`@deepseek-ai/dsh-moriarty`](../bundle/moriarty/README.md), stacked after `dsh-base` and `dsh-web-app`.

| Package | Role | ctx key |
|---|---|---|
| [`moriarty-api/`](moriarty-api/README.md) | Defines Moriarty REST provider registration, selection, and shared errors | `ctx.moriarty` |
| [`moriarty-api-http/`](moriarty-api-http/README.md) | Calls moriarty-be over HTTPS | registers on `ctx.moriarty` |
| [`tool-moriarty/`](tool-moriarty/README.md) | Exposes Moriarty REST reads to the model | registers on `ctx.tools` |

The subsystem reference is [docs/subsystems/moriarty.md](../../docs/subsystems/moriarty.md); rationale in the [Moriarty REST capability Agent Note](../../.agents/notes/implemented/architecture/2026-08-18-moriarty-api-capability-seam.md).

Vendor OpenAPI/MCP corpora and Unsloth SFT live outside this group.
