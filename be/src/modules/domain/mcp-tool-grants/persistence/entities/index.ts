import { McpConnectorAccessEntity } from "./mcp-connector-access.entity"
import { McpToolGrantEntity } from "./mcp-tool-grant.entity"

export { McpConnectorAccessEntity, McpToolGrantEntity }

/** The entities the mcp-tool-grants capability owns, collected by the database module. */
export const mcpToolGrantsEntities: readonly [typeof McpToolGrantEntity, typeof McpConnectorAccessEntity] = [
    McpToolGrantEntity,
    McpConnectorAccessEntity,
] as const
