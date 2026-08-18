# @deepseek-ai/dsh-moriarty-api-http

[English](README.md) | 中文

用于 harness [Moriarty REST 能力](../moriarty-api/README.md)（`ctx.moriarty`）的 HTTPS `MoriartyApiProvider`。它以 bearer token 调用 moriarty-be，并把 JSON 响应体映射为 seam 的可移植记录。

这是一个**实现**包：它向 `ctx.moriarty` 注册提供方，不拥有 `ctx.moriarty` 键，也不注册面向模型的工具（后者属于 `@deepseek-ai/dsh-tool-moriarty`）。与 `@deepseek-ai/dsh-web-search-exa` 一样，它是函数／命名空间插件（`inject: ['moriarty']`）。

## 配置

| 配置键 | 默认值 | 含义 |
|---|---|---|
| `baseURL` | `$MORIARTY_API_BASE_URL` 或 `https://api.themoriarty.app` | API 源站，无尾部斜杠。无法解析时提供方不可用。 |
| `accessTokenEnv` | `MORIARTY_ACCESS_TOKEN` | 每次请求通过 `ctx.credentials` 解析的凭据引用；该 seam 不存在时从启动环境读取。为空或缺失时调用以 `MORIARTY_AUTH_MISSING` 失败。 |
| `timeoutMs` | `30000` | 资源兜底超时。必须是不超过 Node 定时器延迟上限的正整数。 |

```yaml
- id: moriarty-api-http
  name: '@deepseek-ai/dsh-moriarty-api-http'
  config:
    baseURL: !!js process.env.MORIARTY_API_BASE_URL || 'https://api.themoriarty.app'
    accessTokenEnv: MORIARTY_ACCESS_TOKEN
```

## 映射

| 方法 | HTTP |
|---|---|
| `listOrganizations` | `GET /v1/organizations/me` |
| `listBusinesses` | `GET /v1/businesses/{organizationId}/list` |
| `getBusiness` | `GET /v1/businesses/{organizationId}/{businessId}` |
| `getLatestDiagnostic` | `GET .../diagnostics/latest` — HTTP 404 → `null` |
| `listCapsuleFiles` | `GET /v1/capsule/{organizationId}/{businessId}/files` |
| `searchFranceAides` | `GET /v1/france-aides` |

HTTP 重定向会在访问 `Location` 指向的目标之前被拒绝（`redirect: 'error'`），并以 `MORIARTY_REDIRECT_REFUSED` 呈现。HTTP 401 为 `MORIARTY_AUTH_MISSING`；403 为 `MORIARTY_FORBIDDEN`；其他非诊断 404 为 `MORIARTY_NOT_FOUND`。中止的请求以 `MORIARTY_ABORTED` 呈现。bearer 是用户 JWT（`MORIARTY_ACCESS_TOKEN`），绝不是 `ADMIN_API_KEY`。

## 模型体验

通过 [`dsh-tool-moriarty`](../tool-moriarty/README.md) 间接影响；该工具会保留本提供方带端点引用的记录，或在消费方错误包装下原样保留缺失令牌、禁止、未找到、中止、拒绝重定向以及无法处理的响应体失败。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

## 已知限制与暂缓事项

- **OIDC PKCE 暂缓**：第一天的鉴权是 `MORIARTY_ACCESS_TOKEN` 中的静态 bearer；尚无 Keycloak 公共客户端 `moriarty-harness`。
- **中止分类基于错误形态**：只有名为 `AbortError` 的 `DOMException` 会映射为 `MORIARTY_ABORTED`。
- **本提供方不发明 `/v1/agent`**：写入（capsule 上传、资格主张）留给后续 Consumer。
