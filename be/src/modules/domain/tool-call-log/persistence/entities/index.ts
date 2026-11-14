import { ToolCallLogEntity } from "./tool-call-log.entity"

export { ToolCallLogEntity }
export type { ToolMaskedArguments } from "./tool-call-log.entity"

/** The entities the mcp-call-log capability owns, collected by the database module. */
export const toolCallLogEntities: readonly [typeof ToolCallLogEntity] = [ToolCallLogEntity] as const
