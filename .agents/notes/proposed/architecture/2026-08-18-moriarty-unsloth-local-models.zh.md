# Agent Note: Moriarty 由 Unsloth 训练并本地提供的模型

Status: proposed

[English](2026-08-18-moriarty-unsloth-local-models.md) | 中文

## Problem

Moriarty 必须首先跑在小型本地 LLM 上，使事务所可以在不把客户文档发往云端 API 的情况下工作，同时仍允许一条可选的付费 API 路由。

把公共目录里的通用模型拉进 Ollama，并不能稳定地用法语说话、对专家会计师软件 API 发出 OpenAI 风格的 tool call，或阅读扫描件与资产负债表。

训练已经在另一台带 RTX 5090、装有 Unsloth 的 Windows PC 上进行；harness 在 Mac 上开发，必须通过网络消费该模型，而不是在本机训练。

## Proposal

在 5090 上继续用 Unsloth 作为训练器。

不要把未经修改的公共 GGUF 当作产品默认模型。

Moriarty 的默认模型是对视觉-语言 Instruct 检查点做 Unsloth SFT（监督微调）的结果，由 5090 通过实现 `tools` 与 image 分片的 OpenAI 兼容 Chat Completions 端点提供。

Mac 上的 harness 经现有 [`dsh-llm-pi-ai`](../../../../packages/llm/llm-pi-ai/README.md) 手工声明路由（`api: openai-completions`）访问该端点，并由 `agent-default-model` 指向该路由。

云端 adapter（`dsh-llm-deepseek` 或另一条 pi-ai catalog 路由）保持挂载，在操作者选中之前不使用。

### 基座检查点

从 Unsloth 已经能微调的 Qwen2.5-VL 或 Qwen3-VL Instruct 检查点起步，而不是把纯文本 Mistral 当作唯一产品模型。

该系列已带 tool-call 聊天模板与 image token；法语质量随后由数据集承担，而不是再加一套运行时。

先在 32 GB 上用 7B Instruct VL 变体做短周期 Unsloth 迭代，等 tool-trace 集合稳定后再提升到 14B 或 32B QLoRA。

以后可以有第二条纯文本法语专精 pi-ai 路由；只要 pièce 视觉仍在范围内，它就不能当默认。

### 在 5090 上训练与提供

Unsloth 只在 5090 主机上运行。

导出必须保留训练时使用的 tokenizer 聊天模板；用另一套模板去 serve 该导出是产品缺陷，而不是运维不便（[Unsloth GGUF/export guidance](https://unsloth.ai/docs/basics/inference-and-deployment/saving-to-gguf)）。

首选 serve 路径是带 `--enable-auto-tool-choice` 与模型原生 tool parser、并支持视觉的 vLLM（或等价的 OpenAI 兼容服务器）。

只有在 Modelfile 或 `--chat-template` 就是 Unsloth 写出的模板、且 tool-call 解析已用与训练相同的 traces 验证时，才允许经 llama.cpp 或 Ollama 的 GGUF。

Mac 从不加载权重；它只在 pi-ai 路由上设置 `baseURL`（局域网或 SSH 隧道）。

### 数据集：tool traces，而不是在循环里堆 tool

harness 仍为 Moriarty REST 以及后续专家会计师软件 API（MyUnisoft、Pennylane 及其他作为 provider）注册带类型的 tools。

Unsloth 训练模型在用法语*调用这些 tools*，包括用户附上扫描页的情况。

每条训练行是一段 OpenAI-messages 对话：system（persona + tool schemas）、user（法语目标，可选 image）、assistant（`tool_calls`）、tool results、带出处的 assistant 收束散文。

数据集中的 tool JSON Schema 必须从即时 harness tool registry 生成，使 schema 漂移在构建数据集时失败，而不是默默训练昨天的字段。

客户 PII 不得进入数据集；traces 使用合成事务所、SIREN fixture 和已脱敏扫描件。

```json
{
  "messages": [
    {"role": "system", "content": "Tu es Moriarty, assistant de cabinet d'expertise comptable."},
    {"role": "user", "content": "Liste les clients de l'organisation courante et justifie la source."},
    {
      "role": "assistant",
      "tool_calls": [
        {
          "id": "call_1",
          "type": "function",
          "function": {"name": "moriarty_list_businesses", "arguments": "{}"}
        }
      ]
    },
    {"role": "tool", "tool_call_id": "call_1", "content": "{\"businesses\":[{\"id\":\"b1\",\"name\":\"SCI Exemple\"}]}"},
    {"role": "assistant", "content": "Un client: SCI Exemple. Source: GET /v1/businesses de l'organisation courante."}
  ]
}
```

### Harness 路由

Moriarty bundle 把 `llm-pi-ai` 从休眠补丁为名为 `moriarty-local` 的路由，并把 `agent-default-model` 补丁到该路由的 VL 模型 id。

`defaultInput` 与每个模型的 `input` 必须包含 `image`，否则 [`dsh-llm-pi-ai`](../../../../packages/llm/llm-pi-ai/README.md) 会在接触 5090 之前以 `UNSUPPORTED_CONTENT` 拒绝 image 块。

缺少 `baseURL` 或 serve 不可达时，请求必须响亮失败；harness 不得在操作者未显式选择模型的情况下回退到云端密钥。

要求 bearer token 的本地服务器使用 credential 引用；无密钥的 OpenAI 兼容 serve（vLLM）设置 `headers.Authorization: Bearer local`，因为 pi-ai 的 openai-completions 路径仍要求该标头。

```yaml
- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      moriarty-local:
        displayName: Moriarty Unsloth (5090)
        api: openai-completions
        baseURL: http://127.0.0.1:8000/v1
        defaultInput: [text, image]
        headers:
          Authorization: Bearer local
        models:
          - id: moriarty-vl
            name: Moriarty VL
            contextWindow: 32768
            maxTokens: 4096
            input: [text, image]
- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: moriarty-local
    model: moriarty-vl
```

在 Mac 上，`127.0.0.1:8000` 是通往 5090 vLLM 绑定的 SSH 隧道；profile 的 `cordis.patch.yml` 可以替换 `baseURL` 而不改 bundle。

### Overlay 组合

Profile 模板 `moriarty` 依次堆叠 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`，然后 `@deepseek-ai/dsh-moriarty`。

最后一层 bundle 补丁 `llm-pi-ai`、`agent-default-model`、`system-prompt` 以及 `agent-presets` 的 `default`。

随附的 agent preset `moriarty` 为选中它的会话遮蔽 persona。

收集厂商 OpenAPI/MCP 语料并跑 Unsloth SFT 是 5090 上的并行工作流；它不阻塞本 overlay。

### 这并不替代什么

业务层 verifier 与 `justification/*` session 事件仍然必需。

一次正确的 Unsloth tool call 在 [coding-agents-as-general-agents](https://arxiv.org/abs/2604.13107) 意义上仍只是代码层成功；政策遵守与带出处的决策仍是 harness 的义务。

## Alternatives considered

**以通用 Ollama/LM Studio catalog 模型为默认。** 否决：tool-call 可靠性、法语事务所语域和 pièce 视觉才是产品，未经训练的 7B–14B 无法同时站住这三项。

**以纯文本 Mistral/Ministral 作为唯一本地模型。** 母语法语更强，但扫描资产负债表与发票在范围内；第二条 VL 路由会拆开默认值与 Unsloth 周期。

**在 harness 内训练（对真实事务所做 online RL / GRPO）。** 因数据主权与 PII 否决：SFT traces 是合成且经审阅的；真实客户字节不得变成权重。

**用 macos-harness 截图原语代替 VL 检查点。** 作为默认否决：事务所以 Windows 为主，且 5090 已经在训练 VL；桌面控制仍可作为以后的可选插件。

**专用 `dsh-llm-unsloth` adapter。** 在 vLLM/llama.cpp 仍讲 Chat Completions 时否决；只有当 Unsloth 运行时方言无法表示为 pi-ai 手工声明路由时，才值得新 adapter。

## Acceptance criteria

- Moriarty profile 以 `provider: moriarty-local` 启动，且该模型的 `input` 包含 `image`。
- 5090 的 serve 接受 harness 注册的同一套 tool schemas，并返回 `dsh-llm-pi-ai` 能解析进 harness `tool/call` 事件的 `tool_calls`。
- 无 image 的法语用户轮次通过 Moriarty tool 列出企业，而不是编造行。
- 附上一页 bilan 的用户轮次要么发出点名该附件的 tool call，要么在收束散文中引用该页；不得忽略 image。
- 不可达的 `baseURL` 使该步骤以点名端点的错误失败，并且不静默选中 DeepSeek。
- 若 harness tool schema 哈希与已提交的 trace snapshot 不一致，数据集构建失败。

## Risks

GGUF 导出后聊天模板不匹配会产出流畅法语、但 tool call 为零或畸形；首轮 Unsloth 评估必须是 held-out traces 上的 tool-call exact-match，而不是 BLEU。

Mac 与 5090 是不同机器；隧道断开看起来像模型失败，必须按传输来诊断。

高分辨率扫描会在 32 GB 卡上抬高 VL 显存；serve 时的 image 缩放属于 5090 栈，不属于 Mac 提示词。

Unsloth 在过小的 tool 集合上会过拟合名称；以后加入软件 API 需要新的一轮 SFT，而不是只改提示词。

即使训练良好的本地模型仍然过度自信；verifier 与人类 `justification/review` 仍留在产品中。
