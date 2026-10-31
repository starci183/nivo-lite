import { builder } from "@starci/jest-preset"
import type { McpConnectorRow } from "@modules/domain/mcp-connectors"

/** A remote connector row as the admin specs find it: set credential, one stale catalog entry, nothing approved. */
export const hakuenConnectorRowOf = builder<McpConnectorRow>({
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_state: "set",
    credential_set_at: "2026-10-22T01:00:00.000Z",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 3000,
    tool_catalog: [{ name: "old.tool", hash: "h-old" }],
    catalog_hash: "catalog-1",
    approved_catalog: [],
    approved_at: null,
    checked_at: null,
})
