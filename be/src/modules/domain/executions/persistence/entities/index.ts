import { ExecutionEntity } from "./execution.entity"

export { ExecutionEntity }
export type { ExecutionStatusLine } from "./execution.entity"

/** The entities the executions capability owns, collected by the database module. */
export const executionsEntities: readonly [typeof ExecutionEntity] = [ExecutionEntity] as const
