# NIVO MCP: design and worker briefs

The design of NIVO's own tool door: what it serves, how it is proved, and the briefs that build it. The running gateway is
documented in [mcp-gateway.md](mcp-gateway.md); this page adds to it and never restates it. Paths are from the repository root.

## 1. Owner's rulings

- NIVO MCP is a proxy behind one door. Built-in integrations are native tools NIVO builds. Knowledge is read from NIVO's own
  Brain. A third party with an MCP server is plugged in through `registerMcpConnector` and `approveMcpConnector`.
- OpenClaw stays on its HTTP tool bridge. Its `tool.call` runs the gateway in process, so a tool added to the gateway reaches
  OpenClaw and outside clients alike.
- Providers now: Google Drive, SePay, Zalo OA, Telegram. Calendar later. Gmail out.
- Drive disconnect is owner only, like Zalo and SePay.
- The setup chat reads the Brain facts in force, so a conflict shows while chatting and not only when a card is written.

## 2. What the code says

Checked against main at `63ce14e37` plus the lanes in the tree on 2026-10-31.

Confirmed: stateless Streamable HTTP `POST /mcp/:workspaceId` (`be/src/features/api/mcp-endpoint`); an API key bound to one
agent and one workspace (`ApiKeysService.verifyAgentKey`, scope `tools:call`); the meta-tools `tool.search`, `tool.describe`,
`tool.call` (`be/src/modules/domain/mcp-gateway/gateway-surface.service.ts`); `NATIVE_ADAPTERS` in `be/src/modules/domain/mcp-gateway/mcp-gateway.module.ts` with `sepay` (`transactions.list`,
`transactions.debits`) and `einvoice` (`list`, `get`); the bridge path `AgentToolsService` to `TurnGatewayToolsService` to
`McpGatewayService.call`, which also has a fourth meta-tool, `tool.sequence`.

Corrections to what the plan assumed:

| Assumed                                    | Found                                                                                                                                                                                                                                    | Consequence                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `brain.search` runs over `match_knowledge` | `db/migrations/20261109100225_dead-objects_contract_drop.sql:206` drops it and no TS calls it                                                                                                                                            | Search goes through `KnowledgeSearchService.forAgent`, which reaches `KnowledgeChunksService.search`                |
| apps/mcp and apps/cli have no boot proof   | `be/src/tests/fixtures/builders/{api,cli,mcp}.builder.ts` are committed and `starci app check --wiring` compiles the three roots (R272, BE-TEST-12); `app-check-4.log` of 2026-10-31 says `boot wiring: checked, 3 app(s), 0 failure(s)` | The DI graph is proved. What nothing proves is that a built process starts and answers (section 4)                  |
| An adapter can apply the agent's view      | `NativeAdapter.invoke(workspaceId, tool, args)` gets no caller                                                                                                                                                                           | Module, instance and audience cannot be known. `invoke` must receive the caller (W1)                                |
| Reads fit the gateway limit                | the search query timeout is 8000 ms in `be/src/modules/domain/knowledge/knowledge-search.service.ts`; the native limit defaults to 4000 (`MCP_GATEWAY_TIMEOUT_MS`)                                                                       | A slow embedding fails the call and counts on the breaker. `brain.search` passes its own embed budget (section 5.2) |
| The audit masks PII                        | `summaryOf` stores 400 characters of the result in `mcp_call_log`, masking only `secretFields` and fixed secret names. SePay declares none, so payer names reach the console today                                                       | Every native tool declares `secretFields`; SePay is fixed (W2)                                                      |
| A Drive source has no mark                 | `knowledge_sources.origin` exists and `EnqueueKnowledgeSourceInput.origin` takes it                                                                                                                                                      | No migration. Drive writes `origin: "google_drive"`                                                                 |
| Telegram events come from `telegram_inbox` | The table has no `workspace_id` and holds raw bodies                                                                                                                                                                                     | Events are read as Zalo reads them, from conversations and the message feed (section 6.3)                           |
| `readDriveFile` must join the source queue | `SourceReaderService.readLink` already reads a Drive link with the workspace grant                                                                                                                                                       | A picked file is a `url` source. `readDriveFile` stays unused                                                       |

Two import facts decide where code lives. `agent-knowledge` and `google-connections` both reach `mcp-gateway` through
`modules`, so an adapter importing them is an owner cycle (R27, `D:/.claude/contexts/code/be/architecture.md`). And the cli composes
`McpGatewayModule` with neither AI nor knowledge, so a new adapter cannot be a hard provider of that module.

## 3. Shape

```
outside client ── POST /mcp/:ws ──> apps/mcp ──┐
                                               ├─> McpGatewayService.call
OpenClaw ── tool bridge (AgentToolsService) ───┘      schema, grant, approval, breaker, limit, audit
                                                       ├─ native: brain dossier drive telegram zalo sepay einvoice
                                                       └─ remote: servers a workspace registered and approved
```

The door stays three meta-tools. Native tools are found with `tool.search` and called with `tool.call`, so `tools/list` does
not grow with the catalog. Google Drive content is never read live through a tool: it enters through the Brain and is read
with `brain.search`, as the ruling says. A provider MCP server, if one appears, is a remote connector and needs no NIVO code.

## 4. Boot check

Two checks, both required for any change to an app's composition (BE-TEST-12, BE-API-3).

**Wiring**, in the worker's own worktree:

```sh
npx --no-install starci app check --wiring
```

It compiles each real `be/apps/<app>/src/app.module.ts` with `be/src/tests/fixtures/builders/<app>.builder.ts` and resolves
every provider. Proof is the line `boot wiring: checked, 3 app(s), 0 failure(s)`. `BE_APP_BOOT_PROOF_MISSING` is a failure
and blocks at any count. `BOOT_PROOF_TIMEOUT` is no verdict: run it again on a quieter host. It writes the app check cache folder,
which is tracked, so it never runs in the shared checkout, and that folder is not staged.

**Process boot**, new, because wiring runs no `be/apps/<app>/src/main.ts` and no env reader:

```sh
npm run build:be
. D:/starci-tmp/tino/lanes/nivo-env.sh
PORT=18790 npm run start:mcp &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18790/healthz   # 200: the process serves
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18790/readyz    # 200: the database answers
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://127.0.0.1:18790/mcp/00000000-0000-4000-8000-000000000000         # 401: door mounted, guards on (404 means not mounted)
npm run cli -- --help                                  # exit 0, lists migrate, seed, jobs
```

Both need the database at `127.0.0.1:55440`. Run on 2026-10-31 from the `nivo-run` build: mcp initialised its modules, then
exited 1 at connect on that port, and cli `--help` exited 1 with no text, because Docker was not running. So neither app has a
passing process boot on record yet. A worker never starts Docker by hand (rule 8): with the database down the step is reported
as blocked, not skipped. An agent key answers `tools/list` through `be/src/tests/integration/mcp-endpoint/mcp-agent-credential.integration-spec.ts`, which W1 extends.

## 5. Native tools

### 5.1 Gateway changes (W1)

- `NativeAdapter.invoke(workspaceId, tool, args, caller)` with `caller: { agentId, conversationId }`. Existing adapters keep
  their three-parameter signature.
- `McpGatewayModule.register({ natives })`: a list of adapter classes the app passes. `NATIVE_ADAPTERS` injects SePay, e-invoice
  and these from the global container. The cli passes none. Same shape as `DossierReviewModule`'s `reasoner` option.
- `GatewayToolSpec.internalOnly`: a tool no customer conversation may run. With `caller.conversationId !== null` it is hidden
  from search and describe, and a call is refused `internal_only`, audited, before any adapter runs.
- `McpGatewayErrorCode.NativeRefused`, thrown by an adapter for an expected refusal (`not_connected`, `internal_only`). `run`
  turns it into `tool_error`, so it is an answer and never counts on the breaker.
- `registerMcpConnector` refuses a key a native connector uses, so a remote row cannot sit shadowed under `brain`.
- The committed catalog, the `nivo-mcp@1` snapshot that W1 adds under `be/contracts`: the three meta-tools (R302, BE-AI-6). It stops at the door.
  Native tools are listed in the table below and their schemas are generated from their validators.

### 5.2 The view of a call

Each Brain read answers for one view, the same one `knowledge.search` uses and never a wider one:

- `module` and `installationId` come from the caller's agent, read by a new `AgentDirectoryService.lensOf`.
- `audience` is `lensOf` of `be/src/modules/domain/knowledge/lens.policy.ts`. A call with a `conversationId` asks for `customer`, and a customer-facing
  or publishing module sees public only whatever is asked.
- `workspaceId` is always the gateway caller's. No tool takes a workspace, agent or module argument.
- Subject types `customer` and `person` are left out of every Brain tool for every audience. The Brain page keeps them; MCP
  does not serve them. A later ruling can widen this per grant.
- Evidence is returned as `{ kind, label }`. `quote`, `ref` and `connectionId` are dropped.

`brain.search` gives its embedding 2500 ms (new optional `embedTimeoutMs` on `AgentSearch`, default unchanged), so the database
half has room inside 4000 ms. When embedding is slow, unconfigured or out of credits it falls back to word search, as
`passages` already does. An embedding is metered to the workspace through `UsageMeterService`.

### 5.3 Tools

All are `read`, so `opKey` is optional and none writes. A new grant starts at `auto`. Default deny holds: no grant, no call.
Scoping is section 5.2 for `brain.*` and `dossier.*`, and `workspaceId` for the rest. `Masked` is the tool's `secretFields`, which
applies to audit arguments and the result summary at any depth.

| Tool                    | Input                                                                  | Output                                                                                               | Masked                               | Calls                                                                                    |
| ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `brain.search`          | `query` (1 to 500), `limit?` (1 to 8, default 6)                       | `facts: [FactLine]`, `passages: [{ sourceId, title, topic, order, content (400 chars) }]`            | `query`, `value`, `content`, `title` | `BrainFactsReadService.search`, `KnowledgeSearchService.forAgent`, layer `business` only |
| `brain.facts.list`      | `subject?` (160), `limit?` (1 to 50, default 20)                       | `facts: [FactLine]`                                                                                  | `subject`, `value`                   | `BrainFactsReadService.forView`                                                          |
| `brain.facts.get`       | `id` (uuid)                                                            | `FactLine` with `evidence`, `validFrom`, `validTo`, or `not_found`                                   | `value`, `label`                     | `BrainFactsReadService.get`, then `visibleTo` and `inForce`                              |
| `dossier.status`        | none                                                                   | `dossiers: [{ id, ref, category, name, status, findingsOpen }]`, `totals`, `latestRunAt`             | none                                 | `BrainDossiersReadService.all`, new `DossierFindingsService.summaryForAgent`             |
| `dossier.findings.list` | `dossierId?`, `statuses?`, `severities?`, `first?` (1 to 20), `after?` | `findings: [{ id, dossierId, kind, severity, status, title, remedyAction, lastSeenAt }]`, `pageInfo` | `title`                              | new `DossierFindingsService.listForAgent`                                                |
| `drive.status`          | none                                                                   | `{ state, accountMasked, rawBytesUsed, sources: { ready, working, failed } }`                        | none                                 | `ConnectionBindingsReadService`, `KnowledgeSourcesReadService`                           |
| `drive.sources.list`    | `status?`, `limit?` (1 to 50)                                          | `sources: [{ id, title, status, visibility, updatedAt }]`                                            | `title`                              | new `KnowledgeSourcesReadService.ofOrigin`                                               |
| `telegram.status`       | none                                                                   | `connections: [{ id, name, handle, status, needsAttention }]`                                        | none                                 | `ConnectionBindingsReadService`                                                          |
| `telegram.events`       | `connectionId`, `limit?` (1 to 50)                                     | `events: [{ at, direction, delivery, customerMasked }]`                                              | `customerMasked`                     | `AgentConversationsReadService.onConnection`, `AgentMessagesFeedReadService.recentIn`    |
| `zalo.status`           | none                                                                   | `connections: [{ id, name, oaId, status, needsAttention }]`                                          | none                                 | `ConnectionBindingsReadService`                                                          |
| `zalo.events`           | `connectionId`, `limit?` (1 to 50)                                     | as `telegram.events`                                                                                 | `customerMasked`                     | as `telegram.events`                                                                     |
| `sepay.status`          | none                                                                   | `connections: [{ id, name, accountMasked, status, needsAttention }]`                                 | none                                 | `ConnectionBindingsReadService`                                                          |

`FactLine` is `{ id, subject, attribute, value, unit, trust }`. Only the three `brain.*` tools run in a customer turn, under the
public view of section 5.2. Every other tool here is `internalOnly`, and `dossier.*` also answers `NativeRefused: internal_only` to an
agent whose view is customer, for a key held outside a conversation.

The existing `sepay.transactions.list` and `sepay.transactions.debits` keep their shape and gain `secretFields: ["payer", "reference"]`.

PII in answers: no tool answers a message body, a visitor name, a phone number, an email in clear or a raw provider error.
`customerMasked` is the first four and last three characters of the channel id, as the mockup draws it. `accountMasked` masks
the local part of the email. `needsAttention` is a boolean derived from `status` and `last_error`, so the raw text never leaves.
The `connectionId` of an events call is checked against `workspaceId`; a foreign id answers `not_found`.

A role is declared on none of these tools (section 10).

Writes come later and follow one form: `scope: "write"`, `defaultMode: "ask"`, `opKey` required, receipts through
`McpGatewayService.guarded`, audited args masked. `zalo.send` and `telegram.send` are the first candidates. None is built here.

### 5.4 Composition

`apps/mcp` gains the readers and nothing that writes, indexes or queues. Modules take a narrow mode, as
`AgentsModule.register({ directoryOnly: true })` already does:

- `KnowledgeModule.register({ searchOnly: true })`: `UsageMeterService`, `EmbeddingService`, `KnowledgeSearchService`.
- `KnowledgeSourcesModule.register({ readOnly: true })`, with `briefsOf` moved to `KnowledgeSourcesReadService` so search stops
  needing the writer.
- `NivoKnowledgeModule.register({ searchOnly: true, folders: [] })`, `KnowledgeChunksModule`, `BrainFactsModule`.
- `DossierReviewModule.register({ readOnly: true })`, with `reasoner` and `writer` optional in that mode.
- `ConnectionsModule.register({ readOnly: true })` and the read services of `agent-conversations` and `agent-messages`.
- `AiModule` with `ai: parseAiConfig(env)` in `be/apps/mcp/src/mcp.env.ts`. Every AI key is optional, so the app boots without them and search
  uses words. Adding `AI_BASE_URL` and `STARCI_AI_KEY` to the `nivo-mcp` service is a deploy step for the owner; the stack file
  notes today that the gateway gets the database and `CHANNEL_TOKEN_KEY` only.

`apps/api` already holds these modules and only passes `natives`.

Grants: nothing is granted by itself. An owner or manager turns tools on per agent with `setMcpToolGrant`; the console, read-only
today, gets the switch (W5). OpenClaw keeps `knowledge.search` as it is.

## 6. Drive and Telegram

Drawn in `D:/starci-tmp/tino/mockups/providers-drive-telegram-mockup.html`; its to-do list is the checklist. Its open
questions are answered here.

### 6.1 Google Drive

Back-end gaps:

- `DriveGrantService.disconnect` moves to `OWNER`. `authorize` stays owner or manager, the ruling names disconnect only. The hub
  menu and the details page hide it from managers, and the mockup's manager panel is redrawn to match.
- The hub lists Drive: drop `c.provider <> 'google_drive'` in `list` of `be/src/modules/domain/connections/connections.service.ts`. `be/src/modules/domain/connections/connector-catalog.policy.ts` moves
  `google_drive` from `soon` to `early`, because `drive.readonly` is a restricted scope (below).
- `DriveFile.url`: `be/src/modules/integrations/documents/drive-link.policy.ts` builds the address from `id` and `mimeType` (Docs, Sheets and Slides to their
  `docs.google.com` addresses, others to `drive.google.com/file/d/<id>/view`), and `DriveFileType.url` carries it.
- `KnowledgeSourcesInput.origin`, so the ingest progress pane polls only `google_drive` sources.

Setup page: `/connections/drive`, one page per workspace, three steps as drawn (grant, choose, Second Brain) plus the progress
pane. The hub wizard opens with `?connect=google_drive`, and the copy of `googleWizard` is not reused.

Picker and batch add:

- Link path first: paste a folder link, `driveLinkedFolder` lists up to 300 files at three levels, with `truncated`.
- Google Picker: a browser token, used for one `drivePickedFolder` call, never stored. a missing Picker API key (a new public web setting) hides the button, and the link path carries the page. An `empty` folder asks for the files inside.
- Batch add is the existing queue. Ticked files go into `useAddQueue` as links with `url`, `visibility` and `origin:
"google_drive"`, one `enqueueKnowledgeSource` per file, with its per-item errors. No new mutation.

The owner must verify the Google app for `drive.readonly` before shop owners use this. That is outside this code.

### 6.2 What feeds Brain sources

| Input                                 | Becomes                                                      | Path                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Drive file or folder the owner ticked | `knowledge_sources` row, `kind: url`, `origin: google_drive` | `queued`, `reading`, `indexing`, `extracting_facts`, `ready`; proposed facts go to review; a dossier document asks for a review run |
| Telegram bot messages                 | nothing                                                      | A conversation is not a Brain source                                                                                                |
| Zalo OA messages                      | nothing                                                      | Same                                                                                                                                |
| SePay moves                           | nothing                                                      | They stay in `transactions` and are read with the SePay tools                                                                       |

Disconnecting Drive keeps the sources; a re-read of a private file then fails with `DriveGrantMissing`, as the mockup says.

### 6.3 Telegram

The bot wizard stays. Back-end gaps:

- New `TelegramPageService` in `be/src/modules/domain/channels`, with `view` and `events`, owner or manager, beside
  `ZaloPageService`. `view` answers the check, agents and webhook address. `events` reads `onConnection` plus `recentIn`. The
  shared mapping of messages to event rows is extracted from `zalo-page`.
- New feature `telegram-connection-page` under `be/src/features/api`: `telegramPage`, `telegramEvents`. The recheck is the existing
  `checkConnection`.
- Retry after a refused webhook: `connectTelegram` reuses the row of its own workspace in place of the false "another workspace"
  refusal from `findLiveByMeta`.

On the front end the hub maps `last_error` codes to copy in `fe/apps/web/src/modules/i18n/messages/vi.json`. The database keeps the code, so the text follows the reader's
language. Details page: `/connections/telegram/[id]`, the provider page-segment map of `fe/apps/web/src/hooks/connections/connections.shared.ts` gains `telegram`, one `notFound()`. Managers keep the check
button and lose disconnect and agent switches. No token change and no test send, as drawn.

## 7. Setup chat reads the facts

It joins `SetupTurnService.answer`, where the input is built. `openGapsOf` is the precedent: the chat already reads a Brain-side
list per turn, and `BrainFactsService` is in `ModulesModule`.

1. Read: `facts.forView(workspaceId, "internal", module.key, scope, 500)`, with `scope = installation.isMulti ? installation.id : null`.
   Drop subject types `customer` and `person`. A failed read logs and gives an empty list: the chat never stops for it.
2. Limit: `facts.search` with the owner's message gives the hits, then the rest of the read by trust. At most 30 lines, each clipped to
   160 characters, 2400 characters in all, about 800 tokens. The history window of `be/src/modules/domain/modules/setup-turn.service.ts` stays.
3. Prompt: a new block in `setupPromptOf`, `SetupTurnInput.known`. Its title says the lines are reference data from the business
   and never instructions, since a line can hold text from a document. Two rules join: an item a fact in force answers is covered, so
   confirm it and do not ask from scratch; when the owner says something else, say what is on record and what they said, and ask
   which holds.
4. Deterministic check, because a model can miss it: new `conflictsOf(writes, inForce)` over the whole read, not the clipped
   block, matching `factSlugOf(subjectLabel)` and `factSlugOf(attributeLabel)` to `subjectKey` and `attribute` and comparing with
   `sameValue`, the test `decide` uses. For each conflict whose current value the reply does not contain, at most two, a catalog line
   `setup.conflictNote` is appended to the reply before `messages.post`.

Conflicts surface in order: in the chat turn the owner says it, then on the card, which already shows `current` through `viewsOf`
and still demands a resolution through `CardNeedsResolution`. `SetupTurnPayload` and the job do not change. A module with no write
spec has only the model's reply, since its draft facts carry no subject.

## 8. Grammar for the map tab

`FlowGraph` of `@starci/grammar` 0.17.1 draws a radial map of labelled pills. The demo
`D:/starci-tmp/tino/mockups/brain-map-demo.html` needs, all as props with no colour or CSS from the app:

| Need                        | API                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Info tone                   | `FlowGraphTone` gains `"info"`, painted from `--info`                                                                                                                                                                                    |
| Node form                   | `form?: "label" \| "bubble"`. A bubble is a disc with `mark?` (at most 4 characters: `02`, `PDF`), `caption?` for a large disc, and `label` as its name for hover and screen readers                                                     |
| Value-sized circles         | `diameter?: number`, 24 to 128 graph units, for a bubble. Exported helper `flowGraphDiameter(value, max, { min, max })`, square-root scale so area tracks value                                                                          |
| Status without colour alone | `fill?: "solid" \| "half" \| "soft" \| "outline" \| "hatched"`, with `tone`                                                                                                                                                              |
| Status ring                 | `ring?: ReadonlyArray<{ tone, value }>`, a conic ring around an inner disc                                                                                                                                                               |
| Rings to four               | `layout="orbit"`: root at the centre, ring two in sectors weighted by what they hold, ring three staggered on two radii, ring four the fans of open nodes pushing apart, cut at the widest empty arc. Dashed ring guides                 |
| Expand and collapse         | `expandedIds`, `defaultExpandedIds`, `onExpandedChange`. A node's children past ring three show only while it is open. `fanLimit` (default 30) with a `+n` bubble that selects the parent. Open fits the fan                             |
| Hover names                 | One tip on hover and focus: `label`, then `description`. Hidden on move. Same tokens as Tooltip                                                                                                                                          |
| Filter dimming              | `isDimmed?: boolean`. An edge dims with its target; a dimmed node stays focusable                                                                                                                                                        |
| Selected path               | The edges from the root to the selected node draw strong; a bubble draws a selected outline                                                                                                                                              |
| Zoom                        | Text stays at a fixed screen size through a `--starci-flow-zoom` variable, `caption` drops below zoom 0.42 and `mark` below 0.5. The floor is 12px, the rule of `D:/.claude/contexts/ui/components/diagram.md`, not the demo's 8 to 11px |

Keyboard: Enter or Space on an expandable node selects and toggles; Escape clears. Motion follows `prefers-reduced-motion`. The
screen-reader list stays and takes `aria-current`. `fit="contain"` is the map's fit, since ring four cannot meet the readable floor
at full view. The filter chips and the detail rail are the app's, on `TagGroup` and `Pane`.

The tab itself is a later brief: it needs this package and a read of dossiers with their files. It is not in W5.

## 9. Worker briefs

Six, in dependency order. W1 lands first. W2 and W3 follow it and do not depend on each other. W4 follows W2. W5 follows W4. W6 depends on
nothing and is the one brief outside nivo-lite: a package edit lives in a harness worktree (`D:/.claude/contexts/authority/packages.md`), so it
cannot be a worktree of the app.

### 9.0 Common to W1 to W5

Read `D:/starci-tmp/tino/lanes/LANE-BRIEF.md`, then `D:/.claude/AGENTS.md`, `D:/.claude/contexts/README.md`,
`D:/.claude/contexts/harness/rules.md`, then this page. A rule is looked up, not remembered (rule 7): `node
D:/.claude/cli/dist/main.js contexts search "<english question>" --also "<action>" --also "<artifact>" --scope code,hfs,stack --limit 10`;
open the hit and cite it.

Start once the running lanes have landed and `main` is clean:

```sh
git -C D:/starci-lanes/nivo-lite worktree add -b mcp-<id> D:/starci-lanes/nivo-mcp-<id> main
cmd //c mklink //J 'D:\starci-lanes\nivo-mcp-<id>\node_modules' 'D:\starci-lanes\nivo-lite\node_modules'
```

Touch only your paths (rule 4: two tools never touch the same checkout; a defect outside them goes in your report). Commit on
your branch with the hook on. Never: `eslint-disable`, `ts-ignore`, `as` casts, `--no-verify`, gate edits, stash, `reset --hard`, a
branch switch in another checkout, `npm install`, `deps source`, `git push`, deploy, a migration on a shared database, opening
`*.env` or `*.enc*` (LANE-BRIEF; rules 1, 2, 3). TS holds no raw SQL: CRUD through entities, anything else `callDbFunction`. Duplicate
code is extracted, never reordered to dodge the detector. Do not stage the app check cache folder.

Every public method covers its branches and its dependencies' answers (BE-TEST-5), every logic file full coverage (R273), and no owner
import cycle exists, type-only imports included (R27). Done for a back-end brief means: the
listed specs pass; `cd be && npx eslint -- <files>` clean; `npx --no-install tsc --noEmit -p be/tsconfig.json` and `npm run typecheck:tests` clean; `npx --no-install
starci app check --wiring` shows 0 failures (R272); `npx --no-install starci app emit` run when GraphQL changed; committed on the branch;
report the sha. The lane owner lands it. Removing a worktree is the lane owner's: unlink the junction first.

### W1: gateway core

Id `w1-gateway`. Section 5.1 and section 4.

Paths: `be/src/modules/domain/mcp-gateway/*.ts`, `be/src/modules/domain/mcp-gateway/errors/**`, `be/src/modules/domain/mcp-gateway/messages/**`,
the `nivo-mcp@1` catalog snapshot under `be/contracts` (new), `be/src/tests/integration/mcp-endpoint/mcp-agent-credential.integration-spec.ts`,
`be/docs/guides/mcp-gateway.md`. Not `be/src/modules/domain/mcp-gateway/adapters/`.

Build: `invoke` takes `caller`; option `natives`; `internalOnly` in `call`, `search`, `describe`; `NativeRefused` to `tool_error`; the
reserved key refusal in `McpGatewayAdminService`; the catalog snapshot, its shape read from `mcp-tools-snapshot` of `@starci/hfs`
(R302). Update the guide for each.

Specs: `be/src/modules/domain/mcp-gateway/mcp-gateway.service.spec.ts`: an adapter gets the caller; `internal_only` refused with an audit line and no adapter call, for a
conversation only; a hidden tool in search and describe; `NativeRefused` answers `tool_error` and leaves the breaker closed.
`be/src/modules/domain/mcp-gateway/mcp-gateway-admin.service.spec.ts`: a native key refused. A `natives` adapter is found by `connectorsOf` beside the two defaults.
Integration: an agent
key answers `tools/list` with exactly the three meta-tools, equal to the snapshot.

Done: section 9.0, and the process boot of section 4 passes or is reported blocked with the database down.

### W2: native read tools

Id `w2-tools`. Sections 5.2 to 5.4.

Paths: `be/src/modules/domain/native-tools/**` (new capability: its module, one native service and one schema with a spec each for brain, dossier, drive,
telegram, zalo and sepay-status, and a view policy for section 5.2 with the masking helpers),
`be/src/modules/domain/mcp-gateway/adapters/sepay-native.service.ts` and its spec, `be/src/modules/domain/agents/agent-directory.service.ts`
and spec, `be/src/modules/domain/knowledge/knowledge.module.ts`, `be/src/modules/domain/knowledge/knowledge.options.ts`, `be/src/modules/domain/knowledge/knowledge.contracts.ts`,
`be/src/modules/domain/knowledge/knowledge-search.service.ts` and spec, `be/src/modules/domain/knowledge-sources/knowledge-sources.module.ts`, `be/src/modules/domain/knowledge-sources/knowledge-sources.options.ts`,
`be/src/modules/domain/knowledge-sources/knowledge-sources-read.service.ts`, `be/src/modules/domain/knowledge-sources/knowledge-sources.service.ts` and specs, `be/src/modules/domain/nivo-knowledge/nivo-knowledge.module.ts`,
`be/src/modules/domain/nivo-knowledge/nivo-knowledge.options.ts`, `be/src/modules/domain/brain-dossiers/brain-dossiers.module.ts`, `be/src/modules/domain/brain-dossiers/brain-dossiers.options.ts`,
`be/src/modules/domain/agent-conversations/agent-conversations.module.ts`, `be/src/modules/domain/agent-conversations/agent-conversations.options.ts`,
`be/src/modules/domain/agent-messages/agent-messages.module.ts`, `be/src/modules/domain/agent-messages/agent-messages.options.ts`, `be/src/modules/domain/dossier-review/dossier-review.module.ts`, `be/src/modules/domain/dossier-review/dossier-review.options.ts`,
`be/src/modules/domain/dossier-review/dossier-findings.service.ts` and spec, `be/src/modules/domain/connections/connections.module.ts`, `be/src/modules/domain/connections/connections.options.ts`,
`be/src/modules/domain/connections/connection-bindings-read.service.ts`, `be/src/modules/domain/connections/connection-bindings-read.contracts.ts` and spec, `be/apps/mcp/src/**`, `be/apps/api/src/compose/messaging.ts`,
`be/src/tests/fixtures/builders/mcp.builder.ts`, a new native-tools integration spec in `be/src/tests/integration/mcp-endpoint/` (new),
and a new native-tools capability options file in `be/src/tests/world/` (new).

Build: the twelve tools of section 5.3, in `NativeToolsModule`, passed as `natives` in api and mcp and not in cli. `listForAgent` and
`summaryForAgent` are the bodies of `list` and `summary` without the member check, which then call them; the precedent is
`KnowledgeSearchService.forAgent`. `AgentSearch.embedTimeoutMs`. An optional `origin` on `KnowledgeSourcesService.list`, the service half of section 6.1. The narrow
modes of section 5.4. `secretFields` on SePay. Keep each
compose function within its budget; split a compose file if the check asks.

Specs, per adapter: unknown tool; a customer-audience view gets public facts only; a `conversationId` narrows an internal module;
`customer` and `person` subjects never returned; `quote` never returned; a foreign `connectionId` gives `not_found`; `not_connected` for a
workspace with no connection is `NativeRefused`; masked fields absent from `summaryOf`; `brain.search` with embeddings unavailable still
answers by words and passes 2500 ms. `sepay-native`: payer absent from the summary, value unchanged. Integration: a key with a grant on `brain.search` reads a public
fact of its workspace, gets nothing from another, and a line lands in `mcp_call_log` with `query` masked; no grant answers `not_granted`.

Done: section 9.0 and the process boot of section 4.

### W3: setup chat reads facts

Id `w3-setup`. Section 7.

Paths: `be/src/modules/domain/modules/setup-turn.service.ts` and spec, `be/src/modules/domain/modules/policies/setup-turn.policy.ts` and spec,
a new setup-facts policy and spec in `be/src/modules/domain/modules/policies/` (new), `be/src/modules/domain/modules/messages/vi.json`,
`be/src/modules/domain/modules/messages/en.json`, `be/src/modules/domain/modules/messages/modules.messages.ts`,
`be/src/modules/platform/primitives/**`, `be/src/modules/domain/agent-knowledge/knowledge-view.policy.ts` and spec,
`be/src/modules/domain/agent-knowledge/knowledge-recall.service.ts`.

`withinBudget` moves to `platform/primitives`: `modules` may not import `agent-knowledge`, and a copy would trip the detector.

Build: steps 1 to 4 of section 7, `known` on `SetupTurnInput`, `setup.conflictNote` in vi and en.

Specs: `setup-facts.policy`: 31 facts give 30 lines; the budget holds; a hit outranks a higher trust; `customer` and `person` dropped;
`conflictsOf` finds a differing value, ignores `sameValue` and ignores an unrelated key. `setup-turn.service`: a multi instance reads its own
scope; a failed read still answers; a conflict with no mention in the reply appends one note; a reply naming the current value appends none;
at most two notes. `setup-turn.policy`: the block and both rules present, the block absent with no facts.

Done: section 9.0.

### W4: Drive and Telegram back end

Id `w4-providers-api`. Section 6.

Paths: `be/src/modules/domain/google-connections/drive-grant.service.ts` and spec, `be/src/modules/domain/connections/connections.service.ts`
and spec, `be/src/modules/domain/connections/connector-catalog.policy.ts` and spec, `be/src/modules/domain/channel-connections/channel-connections.service.ts`
and spec, a new Telegram page service, its contracts and spec in `be/src/modules/domain/channels/` (new),
a new connection-events policy and spec in the same folder (new, extracted), `be/src/modules/domain/channels/zalo-page.service.ts`,
`be/src/modules/domain/channels/channels.module.ts`, `be/src/modules/domain/channels/index.ts`, `be/src/modules/integrations/documents/drive-link.policy.ts`,
`be/src/modules/integrations/documents/documents.contracts.ts` and specs, `be/src/features/api/telegram-connection-page/**` (new), `be/src/features/api/knowledge/transport/graphql/dto/drive-file.type.ts`,
`be/src/features/api/knowledge/application/knowledge-sources.contracts.ts`, `be/src/features/api/knowledge/application/knowledge-sources.handler.ts`,
`be/src/features/api/knowledge/transport/graphql/knowledge-sources.mapper.ts`, `be/src/features/api/knowledge/transport/graphql/knowledge-sources.resolver.ts` and the input dto,
`be/apps/api/src/compose/api.ts`, `be/contracts/api/schema.graphql` (emitted).

This brief needs W2's `origin` argument on `KnowledgeSourcesService.list`, so it cuts after W2.

Specs: `disconnect` refuses a manager and lets an owner; `authorize` still lets a manager; the hub lists a Drive row; `google_drive` is
`early`; `driveFileUrl` for each Google type and a plain file; a list by origin; `connectTelegram` reuses a same-workspace error row and
still refuses another workspace's bot; `TelegramPageService` refuses staff, answers `notFound` for a foreign id, and its events carry
no body; Zalo events unchanged after the extraction.

Done: section 9.0, with `be/contracts/api/schema.graphql` emitted and committed.

### W5: provider pages

Id `w5-providers-web`. Sections 6 and 5.4 (grants). Needs W4 and the mockup above. Follow the mockup's table of which grammar draws which block.
Read `D:/.claude/contexts/ui/README.md`, `D:/.claude/contexts/ui/components/pane-grid.md`, `D:/.claude/contexts/code/fe/README.md` first, and DNA-COMMON-PAGE-PANES-FLUSH.

Paths: `fe/apps/web/src/app/[locale]/(console)/connections/drive/**` (new), `fe/apps/web/src/app/[locale]/(console)/connections/telegram/**` (new),
`fe/apps/web/src/components/blocks/Drive*/**` (new), `fe/apps/web/src/components/blocks/TelegramConnection*/**` (new),
`fe/apps/web/src/components/blocks/McpGatewaySection/**`, `fe/apps/web/src/components/blocks/ConnectionLibrary/**`,
`fe/apps/web/src/hooks/connections/**`, `fe/apps/web/src/hooks/drive/**` (new), `fe/apps/web/src/hooks/telegramConnection/**` (new),
`fe/apps/web/src/hooks/mcpGateway/**`, `fe/apps/web/src/hooks/knowledge/**`, `fe/apps/web/src/hooks/swr/api/graphql/**`,
`fe/apps/web/src/modules/api/graphql/**`, `fe/apps/web/src/modules/types/connections.ts`, and the keys of the mockup's list of new strings
in `fe/apps/web/src/modules/i18n/messages/vi.json` and `fe/apps/web/src/modules/i18n/messages/en.json`.

Build: hub rows and library card; `DriveWizard` (`?connect=google_drive`, the six failure reasons); `/connections/drive` with its states;
folder link listing; Google Picker behind its public API key setting; batch add through `useAddQueue`; progress pane at 5 s;
`/connections/telegram/[id]`; `last_error` codes to copy; manager views; a grant switch per tool in `McpGatewaySection` calling
`setMcpToolGrant`.

Check: no spec (SHARED-TEST-1). Lint and `cd fe/apps/web && npx tsc --noEmit -p tsconfig.json` clean; walk both pages in owner and manager
role, phone and desktop, on the mockup's states; report what could not be walked.

Done: section 9.0's commit and report rules, with the walk reported.

### W6: FlowGraph package

Id `flowgraph-orbit`. Section 8. Own common block:

Read `D:/.claude/AGENTS.md`, `D:/.claude/contexts/README.md`, `D:/.claude/contexts/harness/rules.md`, `D:/.claude/contexts/authority/packages.md`, `D:/.claude/contexts/grammars/README.md`,
`D:/.claude/contexts/grammars/contract.md`, `D:/.claude/contexts/ui/components/diagram.md`. Look rules up as rule 7 says, scope `ui,grammars`.

Branch from the app so the name carries it: `cd D:/starci-lanes/nivo-lite && npx --no-install starci pkg branch flowgraph-orbit`, then
work in the harness worktree it prints. Never edit `node_modules`, never a shim in the app, never run `deps source` (the lane owner links it).

Paths, in that harness worktree (written as in the main checkout `D:/.claude`): `D:/.claude/packages/grammar/src/core/branch/FlowGraph/**`, `D:/.claude/packages/grammar/src/common/components-navigation.css`,
`D:/.claude/packages/grammar/src/offset-pop/components-navigation.css`, `D:/.claude/packages/grammar/src/stories/NavigationData.stories.tsx`,
`D:/.claude/packages/grammar/package.json`, `D:/.claude/packages/grammar/CHANGELOG.md`, `D:/.claude/contexts/grammars/contract.yaml` (role `diagram`: slots and variants),
`D:/.claude/contexts/ui/components/diagram.md`, `D:/.claude/contexts/decisions/rulings.yaml` (one entry if the owner confirms the API; else list it in
`D:/.claude/contexts/decisions/open-grammar.md`).

Grammar edits are content only (`D:/.claude/contexts/authority/packages.md`): component, CSS, props, a story per new state; no spec suite, no Storybook
plays locally, no other package bumped. Bump the next free minor on harness main: `pkg/claude-spacing-roles` also claims 0.18.0, so say so in
the handoff note. All paint comes from tokens; existing `FlowGraph` uses render unchanged. Lay `orbit` out in `D:/.claude/packages/grammar/src/core/branch/FlowGraph/layout.ts` as pure functions.

Done: `npx --no-install starci pkg test grammar` green (typecheck and build); a story for bubble, ring, dimmed, open fan and `+n`, light and
dark; `starci pkg handoff --note "FlowGraph orbit for the nivo map"`; report the branch and head. Debug alone merges (`D:/.claude/contexts/authority/packages.md`).

## 10. Noticed, outside these briefs

- `roleIn` treats a native connector as usable with no connection behind it, so `payment.credits.list` is always ready and
  `needs_connection` cannot fire for it. That is why no new tool declares a role. `be/src/modules/domain/modules/module-readiness.service.ts` is in a running lane.
- `viewOf` in `agent-knowledge` and `lensOf` in `knowledge` each hold a list of public-only modules.
- `be/src/modules/domain/connections/connections.service.ts`, `be/src/modules/domain/connections/connections-upkeep.service.ts` and `be/src/modules/domain/modules/setup-chat.service.spec.ts` carry uncommitted lanes today. W3 and W4 cut
  after they land.
- `mcp-gateway.md` lists `Known limits`; W1 keeps them. The breaker stays per process, so api and mcp count apart.
