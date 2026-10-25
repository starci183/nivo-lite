# NIVO MCP gateway

One MCP surface per workspace in front of every connector: native connectors in code and remote MCP servers each workspace
registers. NIVO core never names a connector or one of its tools; flows find tools by capability role, agents by search.

## Pieces

- `be/src/modules/domain/mcp-gateway`: the registry (native `sepay` and `einvoice`, remote rows), schema pinning and approval,
  capability roles, the grant check (default deny, data constraints `{ arg, max }`, `limit_vnd`), the approval gate, the
  per-connector time limit and breaker, the masked audit and the replay keys. The api composes it in process for chat turns,
  performers and scheduled jobs; `be/apps/mcp` serves it to outside agents.
- The rows live in their own capabilities, each the one writer of its table: `be/src/modules/domain/mcp-connectors`
  (`mcp_connectors`), `be/src/modules/domain/mcp-tool-grants` (`mcp_tool_grants`, also the seed's batch `upsert`) and
  `be/src/modules/domain/mcp-call-log` (`mcp_call_log`). The SePay connector reads bank credits and debits through
  `TransactionsService.listBankCredits` and `listBankDebits` of `be/src/modules/domain/transactions`.
- `be/src/modules/integrations/mcp`: the official `@modelcontextprotocol/sdk` on both sides: the remote client (it holds the
  credential secrets and reads them by NAME) and the server side of the gateway endpoint.
- Console GraphQL: `mcpConnectors`, `mcpToolGrants`, `mcpCallLog`, `setMcpToolGrant`, `registerMcpConnector`,
  `syncMcpConnector`, `approveMcpConnector`, `checkMcpConnector`; every operation needs the owner or manager role.

## Capability roles

A deterministic NIVO flow that needs "the tool that does X" asks `McpGatewayService.toolForRole(workspaceId, role)`; the answer
is the tool to call (its full name, connector key and display name), or the typed `no_capability`. A remote tool declares its
role with `_meta["nivo/role"]` in `tools/list` (pinned and approved with its schema); a native tool declares it in its manifest.
The vocabulary and the minimal argument and answer shapes are documented on `CapabilityRole` in
`be/src/modules/domain/mcp-gateway/mcp-gateway.contracts.ts`: `identity.find`, `identity.upsert`, `receivable.find`,
`receivable.recordPayment`, `payment.credits.list` and `payment.debits.list` (the SePay connector) and `invoice.list` (the
e-invoice connector). A remote
tool's scope comes from `annotations.readOnlyHint` (read-only, else write) and the members its audit masks from
`_meta["nivo/secretFields"]`. No manifest of a remote connector lives in code.

## Agents wait for their connections

A NIVO module declares the roles its agent requires and uses (`requires.roles` of its definition in
`be/src/modules/domain/modules`; accounting requires `payment.credits.list`). `McpGatewayService.readiness(workspaceId, roles)`
answers whether each role has a usable tool, the missing roles and, for every role, the display names of the connectors that
declare it. `ModuleReadinessService.settle` moves an applied installation to `needs_connection` while a required role is
missing (its agent does not run) and back to `live` once it is there; `paused` stays the owner's own stop. The
`ModuleInstallation` GraphQL type lists the missing roles and their providers in `connectionNeeds`.

## Schema pinning, approval and health

- Registering a remote connector, or `syncMcpConnector`, reads `tools/list` and stores the live snapshot: each tool's name,
  description, input schema, annotations and `_meta` with the sha256 of all of them. An unreachable server marks the connector
  `degraded` and keeps the last snapshot.
- A remote tool runs only while its live hash equals the hash an owner or manager approved with `approveMcpConnector`. A new or
  changed tool (a changed role included) is not listed, not described, not found by role and refused at call time with
  `schema_unapproved` (audited in `mcp_call_log`) until the new snapshot is approved. An approval applies only to the snapshot it
  was made on: a read in between makes it fail with the gateway's catalog-changed error. Who approved and when are kept on the
  connector.
- `checkMcpConnector` pings the server (MCP `ping`) within its time limit and records `active` or `degraded` and the check time.

## One decision point, two rule stores

Every call is decided by one policy decision point: `judgeGrant` in
`be/src/modules/domain/mcp-gateway/grant.policy.ts` hands the grant to `evaluateGate` of `be/src/modules/domain/authority-rules` (the owner of
the rules is also the owner of their evaluation), the same gate the work engine of `be/src/modules/domain/decisions` passes NIVO's
own work items through, so `auto`, `ask` and `never` and the approval that follows mean the same everywhere. The
rules it reads live in two stores on purpose, because they are keyed differently. `authority_rules` holds NIVO's own registry
actions per workspace, department and action, bound by foreign keys to `authority_actions` and `modules`. `mcp_tool_grants`
holds connector tools per agent and full tool name, with data constraints `{ arg, max }` and `limit_vnd`. Connector tools are
not registry actions, and their set changes with each workspace's connectors, so forcing them into the registry keys would be
wrong.

## Time limits and the breaker

- Every connector has its own per-call limit: a remote connector's `timeout_ms`, a native connector's row `timeout_ms` when the
  workspace has one, else `MCP_GATEWAY_TIMEOUT_MS`; it is clamped to 500 to 15000 ms (the `mcp_connectors` check). A native
  adapter's deadline uses the platform timer port of `be/src/modules/platform/queue` (the one the readiness probe uses); a remote
  call is aborted by the MCP client.
- The breaker is kept per workspace and connector, so one slow connector never stalls another. Closed: calls run; 5 failures in
  60 s open it. Open: calls answer `unavailable` / `circuit_open` (an audited refusal, never a throw) for 120 s. Then it is
  half-open: one probe call runs and the others are refused; a good probe closes it, a failed one opens it again.

## Tool listing for agents

Tool names are always `<connector>.<tool>`. `tool.search {query, limit}` answers at most ten matches, by name and description,
among the tools the agent may use: installed (a native connector, or a remote one the workspace registered and did not disable),
approved and granted. `tool.describe` gives one tool's schema and limits, and `tool.call` runs it through the same path as NIVO's
own calls: approved schema, grant, approval, breaker, time limit and audit.
The agent endpoint's `tool.call` takes `opKey` for every write: choose it once for the intended operation and reuse it on
client retries. Client keys are scoped to the authenticated agent. A write without one answers `idempotency_key_required`;
reads may omit it. JSON-RPC request ids are not operation identities.

The gateway tools and native connector tools validate arguments with their owning domain's bounded Zod schemas before running.
The schemas announced to agents are generated from those validators. Invalid arguments answer an MCP tool result with
`isError: true`; a surface validation failure carries `{ error: "invalid_arguments" }`, and a native validation failure carries
the gateway refusal `{ ok: false, code: "invalid_arguments", detail: "Invalid tool arguments" }`. Invalid input never counts as
a connector failure for the circuit breaker. Search limits must be integers from 1 to 10; native list limits must be integers
from 1 to 50. An omitted limit keeps its default, while an invalid value is rejected.

Connector argument JSON is bounded for both remote and native calls: strings up to 8,192 characters, keys up to 100 characters,
100 items per array, 100 properties per object, eight nested containers below the root object, and 65,536 characters of encoded
JSON in total. Full tool names have at most 113 characters; search queries and endpoint operation keys have at most 200. The chat bridge applies the same
bounds to decoded call arguments and to each of its one to ten sequence steps; encoded JSON and reply text have explicit bounds
in its own schema. Object keys named `__proto__` are rejected before parsing. Remote servers remain responsible for their
connector-specific argument shapes.

## The agent endpoint and its per-agent credential

- `be/apps/mcp` serves `POST /mcp/<workspaceId>` (Streamable HTTP, stateless, JSON responses) with the three tools above. The app
  is denied by default like the api (rate limit, origin guard, `CredentialGuard`, `AuthGuard`, one `ErrorsFilter`); it serves no
  user session, so every access token is refused.
- The door is a `@Credential({ kind: "tool-token", workflow: "mcp-gateway" })` door. Its credential is an agent key: an API key
  of `be/src/modules/domain/api-keys` bound to one agent of the workspace (`api_keys.agent_id`, migration
  `supabase/migrations/20261101000903_api-key-agent-binding.sql`) that carries only the `tools:call` scope. An owner or manager creates it with
  `createApiKey(input: { name, agentId })`; the secret is shown once and only its hash is stored.
- `McpAgentAuthenticatorService` of `be/src/modules/domain/api-credentials` verifies it (`ApiKeysService.verifyAgentKey`): the
  caller is the agent the key is bound to, in the only workspace the key acts for. A missing or unknown key, a revoked key, a
  public API key and the key of a paused agent answer `401`; deleting the agent deletes its keys, so its key answers `401` too.
  A key without `tools:call` answers `403`. A credential of another workspace is refused with the gateway's workspace-mismatch error.
  Nothing in the request can choose the agent; the former shared bearer and self-declared agent header are removed.
- The proof is `be/src/tests/integration/mcp-endpoint/mcp-agent-credential.integration-spec.ts`: an agent key reaches its
  granted tool (audited in `mcp_call_log`), and no key, a foreign key, a revoked key and a deleted agent's key answer `401`.
- NIVO's own calls use `McpGatewayService` in process, with a caller the server builds.

## Replay keys

Every write requires a nonblank stable step (`GatewayCaller.opKey`, else the work item); an explicitly blank `opKey` is
refused with `idempotency_key_required` even when a work item is present. The gateway enforces this after its schema, grant
and approval checks, before any receipt claim or connector call. Capability roles do not exempt a tool from its declared
write scope. Direct MCP clients supply `tool.call.opKey` and reuse it on retries; the surface scopes that key to the
authenticated agent. Reads remain live and may omit an operation key.

Writes first claim the existing inbox and save a sealed pending outcome in one domain transaction. The
connector runs only after that transaction commits; its sealed final result replaces the pending outcome. A retry returns the
stored outcome without another connector call, including when the remote tool has no replay argument. If the process stops
before saving the final result, retries answer `unknown_outcome` / `operation_pending`: check the connector's state before
starting another operation. Grants and approved schemas are still checked on every retry. Reads remain live.

Customer-turn step keys use canonical arguments, including nested objects, so reordered JSON properties preserve the key;
array order and changed argument values still identify different operations. The write's Hub card has its own transactional
inbox claim and is posted once.

Local receipt identities hash the original client arguments before replay fields are injected. Adding or removing a remote
replay field in a newly approved schema preserves the operation's receipt; a caller-supplied replay field stays part of its intent.

A remote write tool that declares `idempotencyKey` in its input schema gets one on every call that names none and belongs to a
step: `nivo:` plus the sha256 of the workspace, the step (`GatewayCaller.opKey`, else the work item), the full tool name and the
hash of the arguments. A re-run of the same step with the same arguments, or the replay of its approval, sends the same key, so
the server answers its stored result instead of acting twice. Another step or other arguments make another key, and a replay
key the caller chose is kept.

A write that times out may have run. Only a nonblank string in the tool's declared replay field allows the gateway to send it
once more: the server answers the stored result if the first call went through and runs it only if it did not. Generated keys
qualify. Caller-supplied values stay unchanged; an absent, null, blank or nonstring forwarded key prevents automatic replay.
A write that still has no answer returns `unknown_outcome` (audited as a timeout), never `unavailable`, so the caller does not
assume nothing happened.

## Configuration (api and mcp apps)

- `MCP_GATEWAY_TIMEOUT_MS` (default 4000), `MCP_CLIENT_NAME` (the client name announced to remote servers, default
  `nivo-mcp-gateway`), `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, the primary database and `CHANNEL_TOKEN_KEY`
  (the connection key). The mcp app needs no Supabase setting and no shared token: each agent brings its own key.
- No connector credential is an environment key. A remote connector's bearer credential is sealed per workspace in its own
  `mcp_connectors` row (`credential_sealed`, AES-256-GCM under `CHANNEL_TOKEN_KEY`, through the same connection-secrets cipher as
  a channel connection's credential). `credential_state` is `none` (the server takes no credential), `needed` (it takes one and none
  was entered) or `set`. The gateway opens the sealed value for the one request it sends and never returns it: the console reads
  only the state and when it was set. A value the key cannot open is logged as an error and refused as unreadable, a missing one
  as missing; both reach the agent as `unavailable` and are audited. At boot the api and the mcp app refuse to start when the
  connection key does not open a credential already sealed in the database (an overwritten key).
- Register a remote connector (Settings > Connections > Add a remote connector, owner or manager):
  `registerMcpConnector(input: { key, name, url, credential, contractVersion })`. The credential is entered once and sealed; it is
  read back never, only as set. Then the catalog is read (`syncMcpConnector`, the console's "Test connection", reads the live
  `tools/list`). Rotate it with `setMcpConnectorCredential(input: { key, credential })`, which seals the new value and reads the
  catalog with it. The tools stay unapproved until an owner or manager reviews the pinned tools (`mcpConnectors`) and approves them
  with `approveMcpConnector(input: { key })`.
- Migration `supabase/migrations/20261103000100_mcp-sealed-credential_contract_drop.sql` drops `credential_ref`: a row that named a gateway variable
  becomes `needed`, and its credential is entered once in the console.

## Known limits

- Breaker state is kept in process memory (one api replica).
- Grants are edited through GraphQL (`setMcpToolGrant`); the console shows them read-only.
