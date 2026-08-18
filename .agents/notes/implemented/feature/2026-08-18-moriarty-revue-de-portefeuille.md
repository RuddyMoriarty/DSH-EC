# Agent Note: Cabinet EC revue de portefeuille Cowork job

Status: implemented

English | [中文](2026-08-18-moriarty-revue-de-portefeuille.zh.md)

## Problem

The Moriarty REST seam makes organizations, businesses, and diagnostics callable, but a cabinet session still has no first completed engagement: no playbook that loads those tools, treats HTTP 404 on the latest diagnostic as an empty fact rather than an invented status, and leaves a sourced markdown note in the workspace.

Package tests and the web-preset catalog e2e prove registration. They do not prove an assembled agent followed the playbook and wrote the file.

## Decision

The `moriarty` agent preset ships `revue-de-portefeuille` under its own `skills/` directory and discovers it through `skill-filesystem` `customSkillDirs` resolved from the preset `baseUrl`, the same pattern as `editing-cordis-compositions` on the `cordis` preset.

The playbook writes `revue-portefeuille.md` at the workspace root. A successful empty diagnostic (`No diagnostic for this business` from `moriarty_get_latest_diagnostic`) is recorded as `pas de diagnostic` plus the tool's `Source:` endpoint. `inconnu — pas d'appel API` is reserved for a call that was not made. This job does not search France-aides.

Assembled coverage is the keyless ACP scenario `moriarty-revue-de-portefeuille`: an overlay on `examples/acp-agent` inserts `ctx.moriarty`, the HTTP provider pointed at `http://127.0.0.1:43118`, a loopback fixture that implements the moriarty-be GET routes, and `dsh-tool-moriarty`. Replay re-executes the real HTTP GETs and the `write` tool. The model script is authored (`recorded: false`) because a live model will not reproduce the exact tool sequence. `prepareWorkspace` copies the shipped `SKILL.md` into the snapshot cwd so the loaded body is the product playbook.

HTTP 404 on SAS Beta's latest diagnostic is `null` in the seam and "No diagnostic for this business" in the tool render; the written note must contain `pas de diagnostic` and that endpoint. `Created file` in the write result is the world check.

## Alternatives considered

**Record the scenario against the live DeepSeek API.** Rejected because the job's contract is the tool sequence, the empty diagnostic, and the written file, not a model's wording. An authored script plus refresh of live tool results is reproducible without a key.

**Point the HTTP provider at api.themoriarty.app.** Rejected because keyless CI cannot hold a user JWT or a stable client dataset, and a live 404 is not a fixture.

**Invent `/v1/agent` so the model receives a pre-built portfolio.** Rejected: the seam consumes routes moriarty-be already publishes, and the playbook's job is to call those reads and write the note.

**Keep the skill only in the snapshot workspace.** Rejected because Cabinet EC sessions mount the preset, not the ACP example. Preset-local `customSkillDirs` is the product discovery path; the snapshot copies that same `SKILL.md` so the loaded instructions cannot drift from the preset.

## Consequences

The first Cabinet EC Cowork job is a sourced file, not a chat reply. Catalogue search stays out of this playbook so a France-aides hit cannot be mistaken for eligibility.

`justification/*` session events, UI nodes, and workpaper export remain later work. This job does not claim business-complete engagement beyond the note and its sources.
