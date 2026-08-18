# Agent Note: Moriarty REST capability seam

Status: implemented

[English](2026-08-18-moriarty-api-capability-seam.md) | 中文

## Problem

Moriarty 必须从第一次事务所会话起就能访问现有的 moriarty-be SaaS（`api.themoriarty.app`）：列出用户的组织和客户企业、读取 capsule 文件、加载最新 aide 诊断，以及搜索 France-aides 目录。

面向模型的 API 必须在 HTTP 客户端、鉴权和后续第二个后端变化时保持稳定。把这些读取直接放进 `dsh-tool-moriarty` 会让工具同时拥有提供方选择、bearer 解析、重定向策略、JSON 解析、提示词指引和呈现。在 moriarty-be 上发明 `/v1/agent` 路由会把 harness 耦合到一个尚不存在的后端。

面向 Keycloak 公共客户端 `moriarty-harness` 的 OIDC PKCE 尚未就绪。第一天的鉴权是 `MORIARTY_ACCESS_TOKEN` 中的用户 JWT。把该 seam 放进 `dsh-base` 会在每个编码 agent profile 上挂载用不到的 Moriarty 插件。

## Decision

Moriarty REST 是遵循 [capability-seam Agent Note](2026-06-13-capability-seams.md) 的一等能力 seam：

1. `@deepseek-ai/dsh-moriarty-api`（`packages/moriarty/moriarty-api`）拥有 `ctx.moriarty`、提供方注册、提供方选择、可移植记录和 Moriarty 专用错误。
2. `@deepseek-ai/dsh-moriarty-api-http`（`packages/moriarty/moriarty-api-http`）实现 moriarty-be HTTPS 后端并向 `ctx.moriarty` 注册。
3. `@deepseek-ai/dsh-tool-moriarty`（`packages/moriarty/tool-moriarty`）拥有面向模型的 `moriarty_*` 工具 schema、提示词区段、参数校验、结果格式和基于 `ctx.moriarty` 的呈现。

提供方不注册工具。`dsh-tool-moriarty` 是面向模型的名称、描述、提示词指引、JSON Schema 和呈现的唯一归属方。

`dsh-moriarty` 组合包在宿主平面插入服务和 HTTP 提供方。`moriarty` agent preset 注册这些工具。web profile 不挂载该 seam；在没有 Moriarty 组合包时选择 Cabinet EC preset 会因 `inject: ['moriarty']` 而大声失败。

选择与 `ctx.web` 相同：已配置的提供方 id（`provider`／`$MORIARTY_API_PROVIDER`），或在恰好只注册一个可用提供方时自动选择。产品启用这些工具时它们保持可见；缺失令牌或提供方会在执行时以结构化 `MoriartyError` 失败。

`GET .../diagnostics/latest` 上的 HTTP 404 为 `null`（尚无运行）。其他 404 抛出 `MORIARTY_NOT_FOUND`。带凭据的请求使用 `redirect: 'error'`。bearer 是用户 JWT，绝不是 `ADMIN_API_KEY`。本 seam 不发明 `/v1/agent`。

第一天的鉴权是通过 `ctx.credentials` 的 `MORIARTY_ACCESS_TOKEN`，在该服务缺失时回退到启动环境。OIDC PKCE 保持暂缓。

## Package topology

```text
@deepseek-ai/dsh-tool-moriarty  --depends on-->  @deepseek-ai/dsh-moriarty-api  <--depends on--  @deepseek-ai/dsh-moriarty-api-http
        consumer                                      interface                                  implementation
```

`@deepseek-ai/dsh-moriarty-api` 只依赖 Cordis、schemastery、带品牌的 id 和 `HarnessError`。提供方包只依赖该 seam、凭据和启动环境。`@deepseek-ai/dsh-tool-moriarty` 从不导入 HTTP 提供方。

## Alternatives considered

### 把三种角色合并进一个包

已拒绝。web、bash 和文件系统 seam 已经证明，把选择、HTTP 和工具 schema 混在一起，会使下一个后端或下一个面向模型的名称变成横切修改。Moriarty 采用同样的三角色拆分。

### 在本次变更中交付 OIDC PKCE

已拒绝。尚无 Keycloak 公共客户端 `moriarty-harness`，静态 bearer 已足以证明 HTTP 映射。把 PKCE 放进同一次变更会让 REST 工具被一个仍未完成的身份项目堵住。

### 在 moriarty-be 上发明 `/v1/agent`

已拒绝。harness 消费后端已经发布的 OpenAPI。新的 agent 路由是后端产品决策，不是 harness 变通。

### 把该 seam 挂进 `dsh-base`

已拒绝。每个编码 agent profile 都会加载用不到的 Moriarty 插件，并要求操作员没有的令牌。overlay 组合包才是产品边界。

## Consequences

**工具成功不是业务成功。** 目录命中和 HTTP 200 读取仍需要后续校验器与 `justification/*` 事件；本 seam 只让 REST 读取可被调用。

**Cabinet EC preset 需要 Moriarty profile（或等价的宿主行）。** 在仅 web 的组合上，preset 的 `inject: ['moriarty']` 会在挂载时失败，而不是显示一个无法运行的工具。

**缺失令牌在下一次调用失败，而不是在加载时失败。** 这与 web 搜索一致：凭据轮换时 schema 保持稳定。

**这些工具的组装 snapshot 覆盖是无密钥 ACP 场景 `moriarty-revue-de-portefeuille`。** 包测试与 web-preset 目录 e2e 证明注册和 HTTP 映射；该场景会重新执行真实的 HTTP GET 和工作区写入。playbook 决策见 [revue de portefeuille Agent Note](../feature/2026-08-18-moriarty-revue-de-portefeuille.md)。
