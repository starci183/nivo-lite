import { McpToolGrantEntity } from "./mcp-tool-grant.entity"

export { McpToolGrantEntity }

/** The entities the mcp-tool-grants capability owns, collected by the database module. */
export const mcpToolGrantsEntities = [McpToolGrantEntity] as const
