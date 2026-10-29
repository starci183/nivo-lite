# HAKUEN demo workspace

How the HAKUEN Hotel & Spa workspace is configured in production, and what it relies on. Configuration only: rooms, rates,
bookings, stays and folios stay in the HAKUEN back office and are read live through the MCP gateway (data layer 1).

## Data layers in the seed

| Layer                      | Where the seed puts it                                                                                                                                                                 | Source in the repo                                                                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Live connector data      | The `hakuen` remote MCP connector, registered and approved by the run; agents call its tools through `tool.call`                                                                       | `be/src/modules/domain/workspace-seed/profiles/hakuen-profile.templates.ts` (connector and grants)                                                                                                                                           |
| 2 Second Brain (workspace) | `knowledge_sources` rows (`kind = text`, `origin = seed:hakuen`, status `queued`) plus a `knowledge` outbox job each; the knowledge worker of the api reads them into chunks and facts | `be/src/modules/domain/workspace-seed/profiles/hakuen-documents.templates.ts`, `be/src/modules/domain/workspace-seed/profiles/hakuen-hospitality.templates.ts`, `be/src/modules/domain/workspace-seed/profiles/hakuen-playbook.templates.ts` |
| 4 NIVO base knowledge      | `public.nivo_knowledge`, mirrored by `cli seed-knowledge run`; generic for every workspace, nothing HAKUEN-specific                                                                    | `be/src/modules/domain/nivo-knowledge/nivo-knowledge.templates.ts`                                                                                                                                                                           |

Workspace documents: brand guideline (colors #C2996B / #5A4632 / #FBF7F1, tone, logo), room types, spa menu and prices, front-desk
procedures, discount policy, tax profile with placeholder fields; the hotel and spa operating knowledge (front desk, Vietnamese tax
calendar, e-invoices under ND 123/2020 and TT 78/2021, post templates); and two playbooks:

- Booking (AI Sales, a public document because AI Sales is customer-facing): check availability, quote, hold, confirm, with the
  HAKUEN tool of each step, then hand the conversation to AI CSKH with `conversation.handOff`; any discount above the policy needs
  a manager's approval; what to do when nothing is free, when a hold expired, or on another error. It holds nothing a guest may not see.
- Transfer reconciliation (accounting): read the bank credits, hand the raw transfer memo to the HAKUEN connector to find the open
  receivable (HAKUEN parses its own payment reference), record the payment when the amount matches, send anything else to a person.

NIVO core never names the connector or its tools: the order of calls comes from these documents and the safety from the grants.

## What `cli seed-workspace profile --profile hakuen --owner <email> [--execute]` does

Inputs, both private and sealed:

- `WORKSPACE_SEED_INPUT` (or `_FILE`): the same ensure input as `seed-workspace ensure`, naming the workspace "HAKUEN Hotel & Spa"
  and the owner, manager and staff accounts.
- `WORKSPACE_PROFILE_INPUT` (or `_FILE`): `{"schema":"nivo/workspace-profile-input@1","connectors":{"hakuen":{"url":"https://..."}}}` (plain http only to a loopback host),
  the endpoint of each connector of the profile. It is parsed strictly; a missing endpoint fails the dry run too.

Without `--execute` it validates both inputs and prints the plan (the profile receipt line). With it, every step is idempotent and
every table is written by its owning capability:

1. `WorkspaceSeedService.seedOwned`: accounts, workspace, memberships (unchanged behavior), plus the authenticated owner.
2. Brand: `WorkspacesService.setBrand` as that owner writes `workspaces.display_name` and `workspaces.logo_url =
/brand/hakuen-logo.jpg` (migration `db/migrations/20261101000700_workspace-branding.sql`).
3. Five agents by handle through `AgentRecordsService.ensureByHandle` (`ai-marketing` content, `ai-editor` video, `ai-sales`
   chatbot, `ai-cskh` chatbot, `ai-ke-toan` accounting) and one installation each through `InstallationRecordsService.insert`
   (status `setup`, mode `assist`) when none drives the agent.
4. Connector: as the owner, `McpGatewayAdminService.registerRemote` registers `hakuen` (endpoint from the profile input, contract
   `hakuen-mcp@1`) as a server that takes a credential. Its credential is not a deployment key: until the owner enters it in
   Settings > Connections (sealed in the database), the connector is `needed`, its catalog is not read and the receipt reports no
   tools. Once it is set, the registration reads its live `tools/list` into the pinned snapshot; an unreachable server fails the run. The run never approves the catalog: the receipt reports `connectors: { hakuen: { tools, approved } }`, and
   until the owner approves the tool list in the console the gateway answers the agents' calls as unapproved.
5. Gateway grants through `McpToolGrantsService` (the owner of `mcp_tool_grants`). AI Sales: `hakuen.rooms.searchAvailability`,
   `hakuen.rates.quote`, `hakuen.booking.hold`, `hakuen.folio.get` auto and `hakuen.booking.confirm` auto with the argument bound
   `discountPct <= 0` (HAKUEN's own policy, written as profile data on the gateway's generic argument bounds: any discount goes to
   approval). AI CSKH `hakuen.stay.*`, `hakuen.guest.*`, `hakuen.folio.get` auto, `hakuen.keycode.reveal` ask; the accounting
   agent `sepay.*`, `einvoice.*`, `hakuen.folio.*` auto.
6. Documents (layer 2) through `ProfileSourcesService.keep`, queued into the ingestion in the same transaction; a changed text is
   re-queued, an unchanged one is left alone.
7. Hub rooms when `public.ensure_office_rooms` exists; each agent with a home room is moved there with
   `public.move_office_agent_home` (migration `db/migrations/20261101000800_office-room-home.sql`), AI Sales to `sales`.
8. Authority rules (`AuthorityRulesService.save`) for content, video, chatbot, booking and accounting actions of the registry.

## Production run

Actions > **seed demo workspace** (`.github/workflows/cli-deploy.yml`) > Run workflow from the release tag; `execute` unticked
first (dry run), then ticked. The workflow decrypts the custody on the runner into private files, hands each key to the cli as
`<KEY>_FILE`, and runs `seed-knowledge run` after an executed profile. The owner seals once:

- `starci app secret set production test-accounts WORKSPACE_SEED_INPUT`
- `starci app secret set production test-accounts WORKSPACE_PROFILE_INPUT`

After the executed run, the owner enters the HAKUEN credential once in Settings > Connections (sealed in the database, never shown
again), tests the connection, then reviews the HAKUEN tool list and approves it (`approveMcpConnector`).

The seed creates configuration and knowledge only: no bank transactions, e-invoices, receivables or report rows. The owner connects
SePay (its API token through sealed custody); until then the accounting room shows that it is waiting for the connection.

## DEMO-NOTES (shortcuts)

- Agents are kept by `AgentRecordsService` (an idempotent upsert by handle in the agents capability) instead of
  `AgentsService.create` / the install flow, because those need the api's ports and are not idempotent; no setup-chat context is
  seeded.
- Documents are kept by `ProfileSourcesService` in the knowledge-sources capability (row plus outbox job), not through
  `KnowledgeSourcesService.addSource`, whose billing and storage dependencies are not part of the cli. The api worker does the
  real indexing and fact extraction.
- Room types and spa prices are the owner's list price document; live rates from the back office always win.
- The rooms step is skipped (reported `absent`) where the Hub rooms migration is not deployed.
- The gateway enforces grants from `mcp_tool_grants` (agent and tool, `limit_vnd`, generic `constraints` [{arg, max}]), not
  `authority_rules`. Debt: fold the grants into `authority_rules` behind one policy decision point.
