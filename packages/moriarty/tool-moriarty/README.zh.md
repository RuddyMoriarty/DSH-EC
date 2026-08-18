# @deepseek-ai/dsh-tool-moriarty

[English](README.md) | 中文

面向模型的 Moriarty REST 工具套件，构建于 [Moriarty REST 能力](../moriarty-api/README.md)（`ctx.moriarty`）之上。它只负责面向模型的事项：工具名称、JSON Schema、提示词区段、结果格式，以及 UI 呈现投影（`presentCall` 作为通用搜索卡片）。所有 REST 访问都通过 `ctx.moriarty`；该包绝不导入具体提供方。工具都不公开面向模型的超时：每个工具的协作式工具调用超时预算通过配置在此声明（`timeoutMs`，附加为 `ToolDefinition.timeoutMs`），由 [`@deepseek-ai/dsh-tool-call-timeout-policy`](../../guard/timeout-policy/README.md) 强制执行；每个工具只把 `exec.signal` 转发给 seam。

当产品启用这些工具且存在 `ctx.moriarty` 时，工具保持注册。后端可用性是执行时的问题：缺失令牌或提供方会使调用以结构化 `MoriartyError` 失败。

## 工具

| 工具 | 参数 | 行为 |
|---|---|---|
| `moriarty_list_organizations` | （无） | 列出当前令牌可访问的组织。来源：`GET /v1/organizations/me`。 |
| `moriarty_list_businesses` | `organizationId`，可选 `page`／`size`／`search` | 列出客户企业。来源：`GET /v1/businesses/{organizationId}/list`。 |
| `moriarty_get_business` | `organizationId`、`businessId` | 加载一家企业。来源：`GET /v1/businesses/{organizationId}/{businessId}`。 |
| `moriarty_get_latest_diagnostic` | `organizationId`、`businessId` | 最新诊断，或报告尚不存在。来源：`GET .../diagnostics/latest`。 |
| `moriarty_list_capsule_files` | `organizationId`、`businessId`，可选 `page`／`size` | 列出 capsule 文件。来源：`GET /v1/capsule/{organizationId}/{businessId}/files`。 |
| `moriarty_search_france_aides` | 可选 `search`／`page`／`size` | 搜索 France-aides 目录。命中不是客户资格判定。来源：`GET /v1/france-aides`。 |

每个工具都选择并发调度，因为这些读取不会修改父 agent（智能体）的状态。每次成功渲染都会引用所属端点。

## 配置

| 配置键 | 默认值 | 含义 |
|---|---|---|
| `timeoutMs` | `30000` | 每个 Moriarty 工具的协作式工具调用超时预算（ms）。 |

```yaml
- id: tool-moriarty
  name: '@deepseek-ai/dsh-tool-moriarty'
```

## 模型体验

### 系统提示词

#### 模型所见

这些工具贡献下文的事务所 REST 指引。作用域工具限制不会移除这段独立注册的区段。

##### Moriarty REST 指引

```markdown
Use the Moriarty REST tools for the current cabinet organization, its businesses, capsule files, diagnostics, and the France-aides catalogue. Cite the tool and endpoint in every figure or eligibility claim. A successful tool call is not a completed engagement. A France-aides catalogue hit is not a client eligibility verdict.
```

#### Token 影响

每个请求都有固定的指引成本，即使限制隐藏了 schema。

#### KV Cache 影响

在插件已挂载且指引文本不变时前缀稳定。插件生命周期可能从第一个变更的提示词区段起使复用失效；作用域 schema 限制不会移除它。

### 工具 schema

#### 模型所见

模型看到生成的 [`moriarty_*` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-moriarty)。超时预算是部署设置，不是模型参数。

#### Token 影响

每个请求都有固定的 schema 成本；作用域限制只移除 schema。

#### KV Cache 影响

在定义与可见性不变时前缀稳定。插件生命周期或作用域限制可能从第一个变更的 schema token 起使复用失效。

### REST 结果

#### 模型所见

成功调用是 markdown 列表或一行摘要，后接 `Source: GET <endpoint>`。空页会说明没有组织／企业／文件／aide／诊断。France-aides 结果始终加上 `A catalogue hit is not a client eligibility verdict.` 失败变为 `Error: <message>`。

#### Token 影响

依赖数据的结果会一直重发，直到压缩。

#### KV Cache 影响

只追加；新可见内容跟在可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 参数错误

#### 模型所见

空白 id 恰好变为 `Error: organizationId must be a non-empty string` 或 `Error: businessId must be a non-empty string`。

#### Token 影响

只有失败的调用会添加这些被保留的 token。

#### KV Cache 影响

只追加；新可见内容跟在可复用请求前缀之后，不会使现有 KV Cache 条目失效。

## 已知限制与暂缓事项

- **写入操作不在范围内**：capsule 上传与资格主张留给后续 Consumer 和人工复核策略。
- **没有 Moriarty 专用许可策略**：工具执行时不请求 `ctx.approval`；需要确认的部署必须添加 `tools/pre-execute` 策略。
