import type { CallLogView } from "@modules/domain/tools"
import type { ToolCallLogType } from "./dto/tool-call-log.type"
import type { ToolCallLogInput } from "./dto/tool-call-log.input"
import type { ToolCallLogRequest } from "../../application/tool-call-log.contracts"

/** The audit lines as GraphQL types. */
export const toToolCallLogTypes = (views: ReadonlyArray<CallLogView>): Array<ToolCallLogType> =>
    views.map((view) => ({ ...view }))

/** A finished console command answers true. */
export const toCommandDone = (): boolean => true

/** The audit page request. */
export const toToolCallLogRequest = (workspaceId: string, input: ToolCallLogInput | null): ToolCallLogRequest => ({
    workspaceId,
    limit: input?.limit,
})
