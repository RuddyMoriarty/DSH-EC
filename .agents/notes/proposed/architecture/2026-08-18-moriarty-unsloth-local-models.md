# Agent Note: Moriarty Unsloth-served local models

Status: proposed

English | [中文](2026-08-18-moriarty-unsloth-local-models.zh.md)

## Problem

Moriarty must run first on a small local LLM so a cabinet can work without sending client documents to a cloud API, while still allowing an optional paid API route.

A generic catalog model pulled into Ollama does not reliably speak French, emit OpenAI-style tool calls against expert-comptable software APIs, or read scanned pièces and bilans.

Training already happens on a separate Windows PC with an RTX 5090 and Unsloth; the harness is developed on a Mac that must consume that model over the network rather than train it.

## Proposal

Keep Unsloth as the trainer on the 5090.

Do not treat an unmodified public GGUF as the product default.

The default Moriarty model is an Unsloth SFT (supervised fine-tune) of a vision-language Instruct checkpoint, served from the 5090 over an OpenAI-compatible Chat Completions endpoint that implements `tools` and image parts.

The Mac harness reaches that endpoint through the existing [`dsh-llm-pi-ai`](../../../../packages/llm/llm-pi-ai/README.md) hand-declared route (`api: openai-completions`), with `agent-default-model` pointing at that route.

A cloud adapter (`dsh-llm-deepseek` or another pi-ai catalog route) remains mounted and unused until the operator selects it.

### Base checkpoint

Start from a Qwen2.5-VL or Qwen3-VL Instruct checkpoint that Unsloth already fine-tunes, not from a text-only Mistral as the sole product model.

That family already carries tool-call chat templates and image tokens; French quality is then a dataset obligation, not a second runtime.

Iterate first on the 7B Instruct VL variant for short Unsloth cycles on 32 GB, then promote a 14B or 32B QLoRA once the tool-trace set is stable.

A later text-only French specialist may exist as a second pi-ai route; it must not be the default while pièce vision is in scope.

### Train and serve on the 5090

Unsloth runs only on the 5090 host.

Export must preserve the tokenizer chat template used during training; serving that export with a different template is a product bug, not an ops inconvenience ([Unsloth GGUF/export guidance](https://unsloth.ai/docs/basics/inference-and-deployment/saving-to-gguf)).

Preferred serve path is vLLM (or an equivalent OpenAI-compatible server) with `--enable-auto-tool-choice` and the model's native tool parser, plus vision.

GGUF via llama.cpp or Ollama is acceptable only when the Modelfile or `--chat-template` is the Unsloth-emitted template and tool-call parsing is verified against the same traces used in training.

The Mac never loads weights; it only sets `baseURL` (LAN or SSH tunnel) on the pi-ai route.

### Dataset: tool traces, not a tool zoo in the loop

The harness still registers typed tools for Moriarty REST and later expert-comptable software APIs (MyUnisoft, Pennylane, and others as providers).

Unsloth trains the model to *call those tools in French*, including when the user attaches a scanned page.

Each training row is one OpenAI-messages conversation: system (persona + tool schemas), user (French goal, optional image), assistant (`tool_calls`), tool results, assistant closing prose with sources.

Tool JSON Schema in the dataset must be generated from the live harness tool registry so a schema drift fails dataset build rather than silently training yesterday's fields.

Client PII never enters the dataset; traces use synthetic cabinets, SIREN fixtures, and redacted scans.

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

### Harness route

The Moriarty bundle patches `llm-pi-ai` from dormant to a named route `moriarty-local` and patches `agent-default-model` to that route's VL model id.

`defaultInput` and each model's `input` must include `image`, or [`dsh-llm-pi-ai`](../../../../packages/llm/llm-pi-ai/README.md) rejects image blocks with `UNSUPPORTED_CONTENT` before the 5090 is contacted.

A missing `baseURL` or an unreachable serve fails the request loudly; the harness does not fall back to a cloud key without an explicit operator model selection.

Local servers that demand a bearer token use a credential reference; a keyless OpenAI-compatible serve (vLLM) sets `headers.Authorization: Bearer local` because pi-ai's openai-completions path still requires a header.

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

On the Mac, `127.0.0.1:8000` is an SSH tunnel to the 5090 vLLM bind; the profile `cordis.patch.yml` may replace `baseURL` without changing the bundle.

### Overlay composition

Profile template `moriarty` stacks `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, then `@deepseek-ai/dsh-moriarty`.

That last bundle patches `llm-pi-ai`, `agent-default-model`, `system-prompt`, and `agent-presets` `default`.

The shipped agent preset `moriarty` shadows the persona for sessions that pick it.

Collecting vendor OpenAPI/MCP corpora and running Unsloth SFT is a parallel workstream on the 5090; it does not block this overlay.

### What this does not replace

Business-layer verifiers and `justification/*` session events remain required.

A correct Unsloth tool call is still only code-level success in the [coding-agents-as-general-agents](https://arxiv.org/abs/2604.13107) sense; policy adherence and sourced decisions stay harness obligations.

## Alternatives considered

**Generic Ollama/LM Studio catalog models as the default.** Rejected because tool-call reliability, French cabinet register, and pièce vision are the product, and an untrained 7B–14B does not hold all three.

**Text-only Mistral/Ministral as the sole local model.** Stronger native French, but scanned bilans and factures are in scope; a second VL route would split the default and the Unsloth cycle.

**Training inside the harness (online RL / GRPO on live cabinets).** Rejected for data-sovereignty and PII: SFT traces are synthetic and reviewed; live client bytes must not become weights.

**macos-harness screenshot primitives instead of a VL checkpoint.** Rejected as the default: cabinets are mostly Windows, and the 5090 already trains VL; desktop control remains an optional later plugin.

**A dedicated `dsh-llm-unsloth` adapter.** Rejected while vLLM/llama.cpp speak Chat Completions; a new adapter is only justified if the Unsloth runtime dialect cannot be expressed as a pi-ai hand-declared route.

## Acceptance criteria

- A Moriarty profile boots with `provider: moriarty-local` and a model whose `input` includes `image`.
- The 5090 serve accepts the same tool schemas the harness registers and returns `tool_calls` that `dsh-llm-pi-ai` parses into harness `tool/call` events.
- A French user turn with no image lists businesses through the Moriarty tool rather than inventing rows.
- A user turn that attaches one bilan page produces either a tool call that names the attachment or closing prose that cites the page; it does not ignore the image.
- An unreachable `baseURL` fails the step with a named endpoint error and does not silently select DeepSeek.
- Dataset build fails if a harness tool schema hash does not match the committed trace snapshot.

## Risks

Chat-template mismatch after GGUF export produces fluent French with zero or malformed tool calls; the first Unsloth eval must be tool-call exact-match on held-out traces, not BLEU.

The Mac and the 5090 are different machines; a down tunnel looks like a model failure and must be diagnosed as transport.

High-resolution scans inflate VL VRAM on a 32 GB card; serve-time image resize belongs in the 5090 stack, not in the Mac prompt.

Unsloth on a tiny tool set will overfit names; adding a software API later requires a new SFT round, not a prompt patch alone.

Even a well-trained local model remains overconfident; verifiers and human `justification/review` stay in the product.
