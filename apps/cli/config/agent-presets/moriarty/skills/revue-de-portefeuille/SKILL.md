---
name: revue-de-portefeuille
description: Use when the user wants a weekly or ad-hoc review of the cabinet's client portfolio — list businesses, summarize latest diagnostics, and write a sourced note in the workspace.
---

# Revue de portefeuille

Produce `revue-portefeuille.md` at the workspace root. Write the note in French. Do not invent clients, balances, or eligibility.

## Steps

1. Identify the current organization with `moriarty_list_organizations`. If that tool is missing, stop and say which credential or host connector is absent; do not invent an organization.
2. List businesses for that organization only, with `moriarty_list_businesses`.
3. For each listed business, call `moriarty_get_latest_diagnostic`. A successful empty result (`No diagnostic for this business`) is written as `pas de diagnostic` plus the tool's `Source:` endpoint. Write `inconnu — pas d'appel API` only when that call was not made.
4. Write the note, then close it with sources: each tool name plus its `Source:` endpoint. A successful tool call is not a completed review until the file exists.

Do not call `moriarty_search_france_aides` in this job. A catalogue hit is not an eligibility verdict.
