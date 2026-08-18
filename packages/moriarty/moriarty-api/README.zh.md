# @deepseek-ai/dsh-moriarty-api

[English](README.md) | 中文

**`MoriartyRuntime`**（`ctx.moriarty`）定义 harness 具备哪些 Moriarty REST 读取能力——组织、企业、capsule 文件、诊断、France-aides 目录——并通过多个提供方实现，不把模型约定绑定到 moriarty-be 的 Spring DTO 图。

本包承担 Moriarty REST 能力的 Service Definition 角色：

| 包 | 职责 |
|---|---|
| `@deepseek-ai/dsh-moriarty-api`（本包） | Service Definition：服务、提供方注册表、选择策略、请求／结果记录、`MoriartyError` 分类体系 |
| `@deepseek-ai/dsh-moriarty-api-http` | 提供方：面向 `api.themoriarty.app` 的 HTTPS 客户端 |
| `@deepseek-ai/dsh-tool-moriarty` | Consumer：面向模型的 `moriarty_*` 工具 schema，构建于 `ctx.moriarty` 之上 |

提供方注册的是**能力**而非工具。`dsh-tool-moriarty` 是面向模型的名称、描述、提示词指引、JSON Schema 和呈现的唯一归属方。

## 服务 API（`ctx.moriarty`）

| 成员 | 语义 |
|---|---|
| `registerProvider(provider)` | 注册后端。id 重复时抛出 `MoriartyError` `MORIARTY_DUPLICATE_PROVIDER`。返回 disposer。随调用 fiber 一并 dispose（资源释放）。 |
| `listOrganizations(signal?)` | `GET /v1/organizations/me`。 |
| `listBusinesses(request, signal?)` | `GET /v1/businesses/{organizationId}/list`。 |
| `getBusiness(request, signal?)` | `GET /v1/businesses/{organizationId}/{businessId}`。 |
| `getLatestDiagnostic(request, signal?)` | `GET .../diagnostics/latest`。HTTP 404 为 `null`（尚无运行），不会抛出。 |
| `listCapsuleFiles(request, signal?)` | `GET /v1/capsule/{organizationId}/{businessId}/files`。 |
| `searchFranceAides(request, signal?)` | `GET /v1/france-aides`。目录命中不是客户资格判定。 |

## 选择

选择绝不依赖注册、配置或 HMR（热模块替换）顺序。能力要么具有显式提供方 id（配置 `provider`，或由环境变量 `$MORIARTY_API_PROVIDER` 提供相同字段），要么在恰好只注册一个可用提供方时自动选择。每个方法会在执行时解析提供方：

| 情况 | 执行 |
|---|---|
| 已配置 id 已注册且 `available()` | 运行该提供方 |
| 已配置 id 未注册 | `MORIARTY_PROVIDER_CONFIGURED_MISSING` |
| 已配置 id 已注册但不可用 | `MORIARTY_PROVIDER_CONFIGURED_UNAVAILABLE` |
| 无 id，恰好一个已注册的可用提供方 | 运行它 |
| 无 id，没有可用提供方 | `MORIARTY_PROVIDER_UNAVAILABLE` |
| 无 id，多个可用提供方 | `MORIARTY_PROVIDER_AMBIGUOUS` |

提供方的 `available()` 是便宜的局部检查，且**禁止发起网络调用**。`dsh-tool-moriarty` 永远不会调用它——工具通过 `ctx.moriarty` 执行，并按抛出的 code 路由。

## 模型体验

通过 `dsh-tool-moriarty` 间接影响；该工具会保留带端点引用的 REST 记录，或者原样保留以下失败：已配置的提供方缺失、提供方不可用、无提供方、存在多个提供方以及 `Error: <message>`；本注册表自身不贡献提示词或 schema。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

## 已知限制与暂缓事项

- **没有观测接口**：可用性只能通过执行方法并按抛出的 `MoriartyError` code 路由来观测。
- **本包不含 OIDC PKCE**：第一天的鉴权是 `MORIARTY_ACCESS_TOKEN` 中的 bearer；解析由 HTTP 提供方负责。
- **本 seam 不发明 `/v1/agent`**：它只映射 moriarty-be 已经发布的端点。
