# NIVO MCP gateway

One MCP surface per workspace in front of every connector (native adapters in code, remote MCP servers registered per workspace).
The authoritative contract is `D:/starci-tmp/nivo-demo/contracts/mcp-gateway.md` (copied here at release).

## Pieces

- `be/apps/mcp`: the gateway app. `POST /mcp/<workspaceId>` (Streamable HTTP, stateless JSON), `Authorization: Bearer
  <MCP_GATEWAY_AGENT_TOKEN>` + `X-Nivo-Agent: <agentId>`. Three tools: `gateway.search`, `gateway.describe`, `gateway.call`.
- `be/src/modules/domain/mcp-gateway`: registry (native `sepay`, `einvoice`; remote rows in `mcp_connectors`), grants
  (`mcp_tool_grants`, default deny, `limit_pct` / `limit_vnd`), the gate, the 4 s time limit, the per-connector breaker
  (5 failures / 60 s → open 120 s), the masked audit (`mcp_call_log`). The api composes the same module in process for chat turns.
- `be/src/modules/integrations/mcp`: the remote client over the official `@modelcontextprotocol/sdk`.
- `customer-turns` (gateway context, ownership policy, Sales holds) and `work-performers` (`gateway_call` approval replay,
  `care_early_checkin`) use the gateway; HAKUEN business rules stay in the HAKUEN back-office.
- Console: `/connections` shows the gateway region (connectors, grants, audit). GraphQL: `mcpConnectors`, `mcpToolGrants`,
  `mcpCallLog`, `setMcpToolGrant`, `registerMcpConnector`, `syncMcpConnector`.

## Configuration (api and mcp apps)

- `MCP_GATEWAY_CREDENTIALS=MCP_HAKUEN_CLIENT_SECRET` (comma-separated NAMES); each value through `<NAME>_FILE`.
- `MCP_GATEWAY_AGENT_TOKEN_FILE` (mcp app only), `MCP_GATEWAY_TIMEOUT_MS` (default 4000), plus `PORT` and the primary database.
- Register HAKUEN: `registerMcpConnector(input: { key: "hakuen", name: "HAKUEN Back-office", url: "https://…/mcp",
  credentialRef: "MCP_HAKUEN_CLIENT_SECRET", contractVersion: "hakuen-mcp@1" })`, then `syncMcpConnector(key: "hakuen")`.
- `cli connect-channel zalo --workspace <id> [--bind]` reads `ZALO_APP_ID`, `ZALO_APP_SECRET_FILE`, `ZALO_OA_SECRET_FILE`.

## DEMO-NOTES (shortcuts)

- Breaker state and the 60 s guest-context cache are in process memory (one api replica).
- Hub cards are written as one-line agent messages (the Hub card column belongs to the hub branch); the approval itself is the
  existing work-item decision card.
- Ownership moves on the inbound turn only; the HAKUEN webhook (`stay.checked_in` / `checked_out`) is not wired yet.
- Grants are edited through GraphQL (`setMcpToolGrant`); the console shows them read-only.
- `care_early_checkin` is a chatbot-module action (front desk approval, then `stay.checkIn` + `keycode.reveal`); the owner's generic
  `tool_call` command replaces it later.
- The mcp app answers `approval_required` to external agents but opens no work item (only NIVO's own performers do).
- `supabase/types/database.types.ts` must be regenerated (`npm run contract:emit` with the local stack) after the migration.
