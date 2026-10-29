import { McpConnectorEntity } from "./mcp-connector.entity"

export { McpConnectorEntity }

/** The entities the mcp-connectors capability owns, collected by the database module. */
export const mcpConnectorsEntities = [McpConnectorEntity] as const
