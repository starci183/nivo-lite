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

A remote write tool that declares `idempotencyKey` in its input schema gets one on every call that names none and belongs to a
step: `nivo:` plus the sha256 of the workspace, the step (`GatewayCaller.opKey`, else the work item), the full tool name and the
hash of the arguments. A re-run of the same step with the same arguments, or the replay of its approval, sends the same key, so
the server answers its stored result instead of acting twice. Another step or other arguments make another key. A call with no
step is sent without a key, and a key the caller chose is kept.

A write that times out may have run. When it carries its replay key, the gateway sends it once more: the server answers the
stored result if the first call went through and runs it only if it did not. A write that still has no answer, or has no replay
key, answers `unknown_outcome` (audited as a timeout), never `unavailable`, so the caller does not assume nothing happened.

## Configuration (api and mcp apps)

- `MCP_GATEWAY_CREDENTIALS`: the comma-separated credential NAMES a remote connector may reference; each value is read through
  `<NAME>_FILE`.
- `MCP_GATEWAY_TIMEOUT_MS` (default 4000), `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS` and the primary database. The mcp app needs no
  Supabase setting and no shared token: each agent brings its own key.
- Register a remote connector: `registerMcpConnector(input: { key, name, url, credentialRef, contractVersion })`, which reads its
  catalog; then an owner or manager reviews the pinned tools (`mcpConnectors`) and approves them with
  `approveMcpConnector(input: { key })`.

## Known limits

- Breaker state is kept in process memory (one api replica).
- Grants are edited through GraphQL (`setMcpToolGrant`); the console shows them read-only.
