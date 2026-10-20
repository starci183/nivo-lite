# HAKUEN demo workspace

How the HAKUEN Hotel & Spa workspace is configured in production, and what it relies on. Configuration only: rooms, rates,
bookings, stays and folios stay in the HAKUEN back office and are read live through the MCP gateway (data layer 1).

## The four data layers in the seed

| Layer | Where the seed puts it | Source in the repo |
| --- | --- | --- |
| 2 Second Brain (workspace) | `knowledge_sources` rows (`kind = text`, `origin = seed:hakuen`, status `queued`) plus a `knowledge` outbox job each; the normal knowledge worker of the api reads them into chunks, embeddings and facts | `be/src/modules/domain/workspace-seed/profiles/hakuen-documents.ts` |
| 4 NIVO base knowledge | `public.nivo_knowledge`, mirrored by `cli seed-knowledge run` | `be/src/modules/domain/nivo-knowledge/hospitality-knowledge.templates.ts` (booking, accounting, content folders) |

Workspace documents: brand guideline (colors #C2996B / #5A4632 / #FBF7F1, tone, logo), room types, spa menu and prices, front-desk
procedures, discount policy (no self-granted discount; any price other than the back-office quote needs a manager; phone identity
needs front-desk confirmation; key codes only after front-desk approval), tax profile with placeholder fields.

Base knowledge: hospitality and spa operations (booking, check-in/out, early check-in, returning guests, upsell), Vietnamese tax
calendar (VAT, PIT, CIT, license fee), e-invoices under ND 123/2020 and TT 78/2021, hospitality post templates.

## What `cli seed-workspace profile --profile hakuen --owner <email> [--execute]` does

Input: `WORKSPACE_SEED_INPUT` (or `_FILE`), the same private ensure input as `seed-workspace ensure`, naming the workspace
"HAKUEN Hotel & Spa" and the owner, manager and staff accounts. Without `--execute` it validates and prints the plan
(`NIVO_WORKSPACE_PROFILE_RECEIPT=`). With it, every step is idempotent:

1. `WorkspaceSeedService.seed`: accounts, workspace, memberships (unchanged behavior).
2. Brand: `workspaces.display_name`, `workspaces.logo_url = /brand/hakuen-logo.jpg` (migration `20261101000700_workspace-branding.sql`).
3. Five agents by handle (`ai-marketing` content, `ai-editor` video, `ai-sales` chatbot, `ai-cskh` chatbot, `ai-ke-toan`
   accounting) and one `module_installations` row each (status `setup`, mode `assist`) when none drives the agent.
4. Gateway grants in `mcp_tool_grants` when that table exists (demo/sales branch): AI Sales `hakuen.*` auto,
   `hakuen.booking.confirm` and `hakuen.spa.confirm` auto with `limit_pct = 0` (any discount needs approval); AI CSKH
   `hakuen.stay.*`, `hakuen.guest.*`, `hakuen.folio.get` auto, `hakuen.keycode.reveal` ask; AI Kế toán `sepay.*`, `einvoice.*`,
   `hakuen.folio.*` auto. Otherwise the receipt says `toolGrants: "absent"`.
5. Authority rules (`AuthorityRulesService.save`) for content, video, chatbot, booking and accounting actions of the registry.
6. Documents (layer 2) queued into the ingestion; a changed text is re-queued, an unchanged one is left alone.
7. Hub rooms when `public.ensure_office_rooms` exists (demo/hub branch); agents are moved to their home room (AI Sales to `sales`).

## Production run

Actions > **seed demo workspace** > Run workflow from the release tag; `execute` unticked first (dry run), then ticked. The workflow
decrypts the custody in memory on the runner, hands each key to the cli as `<KEY>_FILE`, and runs `seed-knowledge run` after an
executed profile. The owner seals `WORKSPACE_SEED_INPUT` once: `starci app secret set production test-accounts WORKSPACE_SEED_INPUT`.

## DEMO-NOTES (shortcuts)

- Agents and installations are written with SQL in the seed (idempotent upsert by handle) instead of `AgentsService.create` /
  the install flow, because those capabilities need the api's ports and are not idempotent; no setup-chat context is seeded.
- Documents are inserted as rows plus an outbox job, not through `KnowledgeSourcesService.addSource` (its billing and storage
  dependencies are not part of the cli). The api worker does the real indexing and fact extraction.
- Room types and spa prices are the owner's list price document; live rates from the back office always win.
- Gateway and rooms steps are skipped (reported `absent`) until the demo/sales and demo/hub migrations are deployed.
