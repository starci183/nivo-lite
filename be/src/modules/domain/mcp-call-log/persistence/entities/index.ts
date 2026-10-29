import { McpCallLogEntity } from "./mcp-call-log.entity"

export { McpCallLogEntity }
export type { McpMaskedArguments } from "./mcp-call-log.entity"

/** The entities the mcp-call-log capability owns, collected by the database module. */
export const mcpCallLogEntities = [McpCallLogEntity] as const
