# Engine tools

The one call path of every tool a graph node, an engine job or the outbound MCP app calls. NIVO calls no MCP server: the engine
reaches its tools directly, and the mcp app is a thin surface over this same module. Concepts: `.starciwork/concepts/tools.md`,
`engine-core.md`, `rights.md`, `mcp.md`. Paths are from the repository root.

## Pieces

- `be/src/modules/domain/tools` (`ToolsModule`): the registry of the tool families in code (`ToolRegistryService`), the node tool
  door (`NodeToolDoorService`), the tool runner (`ToolRunnerService`: the account choice and its fallback), the provider rights
  (`ProviderAbilitiesService`: attachments, display-only abilities), the data rights, the console (`ToolsConsoleService`: the rights
  board, the grant rows of a road outside every node, the audit log) and the built-in families (`sepay`, `einvoice`, the effect tools).
- A **tool family** is one piece of engine or provider-adapter code serving a set of tools: `NativeToolFamily` (its `ToolManifest`
  and `invoke`). Apps add families with `ToolsModule.register({ natives: [FamilyClass] })`; `NATIVE_TOOL_FAMILIES` is the token.
- The rows live in their own capabilities, each the one writer of its table: `tool-grants` (`mcp_tool_grants`,
  `mcp_connector_access` and the node rights tables), `tool-call-log` (`mcp_call_log`), `tool-receipts` (`mcp_gateway_receipts`).
  The table names keep their old spelling until the squashed baseline renames them.
- `be/src/modules/domain/mcp-endpoint` (`McpEndpointModule`, `McpSurfaceService`) and `be/src/modules/integrations/mcp`
  (`McpServerService`, the official server SDK): the OUTBOUND endpoint only, registered by `be/apps/mcp`.

## One call

name → family (`familiesOf()`, the same for every workspace) → arguments (the family's bounded schema) → rights (the account
attachment, the step node's declared mode `auto | ask`; outside every node a read runs and a write asks) → graph hold and taint →
receipt once for a write (`tool-receipts`) → the family's code under its time limit (its manifest's `timeoutMs`, else
`TOOLS_TIMEOUT_MS`, default 4000, up to the 10 min ceiling) behind its breaker (per workspace and family, in memory) → one masked
audit line. A failure is an answer (`unavailable`, `unknown_outcome`), never a throw.

## Removed

Remote MCP servers as tool sources (connector rows, catalogs, approvals, bearer credentials, the 15 s remote clamp, the connection
key boot check), the per-agent MCP endpoint list and the default receiving account. Their GraphQL fields the fe still types answer
nothing (`mcpConnectors` answers no row; `registerMcpConnector`, `syncMcpConnector`, `approveMcpConnector`, `checkMcpConnector`,
`setMcpConnectorCredential`, `setDefaultReceivingAccount` refuse with `TOOLS_REMOVED`; `isDefaultReceiving` is always false).
