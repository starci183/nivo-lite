import type { SetSyncScheduleRequest } from "../../application/set-sync-schedule.contracts"
import type { SetSyncScheduleInput } from "./dto/set-sync-schedule.input"

/** Maps the GraphQL arguments of setSyncSchedule to the request. */
export const toSetSyncScheduleRequest = (workspaceId: string, input: SetSyncScheduleInput): SetSyncScheduleRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    everyMinutes: input.everyMinutes,
})
