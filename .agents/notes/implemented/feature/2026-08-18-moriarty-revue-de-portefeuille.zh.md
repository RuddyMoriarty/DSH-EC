# Agent Note: Cabinet EC revue de portefeuille Cowork job

Status: implemented

[English](2026-08-18-moriarty-revue-de-portefeuille.md) | 中文

## Problem

Moriarty REST seam 让组织、企业和诊断可被调用，但事务所会话仍没有第一份完成的业务交付：没有一套 playbook 去加载这些工具、把最新诊断上的 HTTP 404 当成空事实而不是编造状态，并在工作区留下一份带出处的 markdown 笔记。

包测试和 web-preset 目录 e2e 只证明注册。它们不能证明组装后的 agent 遵循了 playbook 并写出了文件。

## Decision

`moriarty` agent preset 在自己的 `skills/` 目录下交付 `revue-de-portefeuille`，并通过从 preset `baseUrl` 解析的 `skill-filesystem` `customSkillDirs` 发现它，模式与 `cordis` preset 上的 `editing-cordis-compositions` 相同。

该 playbook 在工作区根目录写入 `revue-portefeuille.md`。成功的空诊断（`moriarty_get_latest_diagnostic` 返回的 `No diagnostic for this business`）记为 `pas de diagnostic` 加上工具的 `Source:` 端点。`inconnu — pas d'appel API` 仅保留给未发出的调用。本作业不搜索 France-aides。

组装覆盖是无密钥 ACP 场景 `moriarty-revue-de-portefeuille`：在 `examples/acp-agent` 上的 overlay 插入 `ctx.moriarty`、指向 `http://127.0.0.1:43118` 的 HTTP 提供方、实现 moriarty-be GET 路由的 loopback fixture，以及 `dsh-tool-moriarty`。回放会重新执行真实的 HTTP GET 和 `write` 工具。模型脚本是手写的（`recorded: false`），因为线上模型不会复现这一精确工具序列。`prepareWorkspace` 把随附的 `SKILL.md` 复制进 snapshot cwd，使加载的正文就是产品 playbook。

SAS Beta 最新诊断上的 HTTP 404 在 seam 中是 `null`，在工具渲染中是 "No diagnostic for this business"；写出的笔记必须包含 `pas de diagnostic` 和该端点。write 结果中的 `Created file` 是对外部世界的核验。

## Alternatives considered

**对着线上 DeepSeek API 录制该场景。** 已拒绝，因为该作业的契约是工具序列、空诊断和写出的文件，而不是模型措辞。手写脚本加上对实时工具结果的 refresh 无需密钥即可复现。

**把 HTTP 提供方指向 api.themoriarty.app。** 已拒绝，因为无密钥 CI 不能持有用户 JWT 或稳定客户数据集，线上 404 也不是 fixture。

**发明 `/v1/agent` 让模型直接收到预构建的投资组合。** 已拒绝：seam 只消费 moriarty-be 已经发布的路由，playbook 的工作就是调用这些读取并写出笔记。

**只把 skill 放在 snapshot 工作区。** 已拒绝，因为 Cabinet EC 会话挂载的是 preset，不是 ACP 示例。preset 本地的 `customSkillDirs` 才是产品发现路径；snapshot 复制同一份 `SKILL.md`，使加载的指令不会与 preset 漂移。

## Consequences

第一份 Cabinet EC Cowork 作业是带出处的文件，而不是聊天回复。本 playbook 不搜索目录，以免 France-aides 命中被误当成资格判定。

`justification/*` 会话事件、UI 节点和工作底稿导出仍是后续工作。本作业不把业务完成宣称成超出该笔记及其出处的范围。
