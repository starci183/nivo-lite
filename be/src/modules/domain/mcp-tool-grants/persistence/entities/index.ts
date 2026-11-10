import { McpConnectorAccessEntity } from "./mcp-connector-access.entity"
import { McpDefaultAccountEntity } from "./mcp-default-account.entity"
import { McpToolGrantEntity } from "./mcp-tool-grant.entity"

export { McpConnectorAccessEntity, McpDefaultAccountEntity, McpToolGrantEntity }

/** The entities the mcp-tool-grants capability owns, collected by the database module. */
export const mcpToolGrantsEntities: readonly [
    typeof McpToolGrantEntity,
    typeof McpConnectorAccessEntity,
    typeof McpDefaultAccountEntity,
] = [McpToolGrantEntity, McpConnectorAccessEntity, McpDefaultAccountEntity] as const
