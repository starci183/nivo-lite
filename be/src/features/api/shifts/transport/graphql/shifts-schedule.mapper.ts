import type {
    ExplainScheduleOutput,
    ProposeWeekOutput,
    ReassignShiftOutput,
    RequestOutput,
} from "@modules/domain/shifts"
import type { AddShiftsDraftShiftRequest } from "../../application/add-shifts-draft-shift.contracts"
import type { ExplainShiftsScheduleRequest } from "../../application/explain-shifts-schedule.contracts"
import type { ProposeShiftsWeekRequest } from "../../application/propose-shifts-week.contracts"
import type { ReassignShiftsShiftRequest } from "../../application/reassign-shifts-shift.contracts"
import type { RemoveShiftsDraftShiftRequest } from "../../application/remove-shifts-draft-shift.contracts"
import type { RequestShiftsPublishRequest } from "../../application/request-shifts-publish.contracts"
import type { AddShiftsDraftShiftInput } from "./dto/add-shifts-draft-shift.input"
import type { ExplainScheduleType } from "./dto/explain-schedule.type"
import type { ProposeShiftsWeekInput } from "./dto/propose-shifts-week.input"
import type { ProposeWeekType } from "./dto/propose-week.type"
import type { ReassignShiftsShiftInput } from "./dto/reassign-shifts-shift.input"
import type { ReassignShiftsShiftType } from "./dto/reassign-shifts-shift.type"
import type { RequestStatusType } from "./dto/request-status.type"
import type { ShiftsScheduleRefInput } from "./dto/shifts-schedule-ref.input"
import type { ShiftsShiftRefInput } from "./dto/shifts-shift-ref.input"

/** Maps the GraphQL input to the week proposal request of the workspace it names. */
export const toProposeShiftsWeekRequest = (
    workspaceId: string,
    input: ProposeShiftsWeekInput,
): ProposeShiftsWeekRequest => ({
    workspaceId,
    week: input.week,
})

/** Maps the GraphQL input to the explanation request of the workspace it names. */
export const toExplainShiftsScheduleRequest = (
    workspaceId: string,
    input: ShiftsScheduleRefInput,
): ExplainShiftsScheduleRequest => ({ workspaceId, scheduleId: input.scheduleId })

/** Maps the GraphQL input to the reassignment request of the workspace it names. */
export const toReassignShiftsShiftRequest = (
    workspaceId: string,
    input: ReassignShiftsShiftInput,
): ReassignShiftsShiftRequest => ({ workspaceId, shiftId: input.shiftId, staffId: input.staffId })

/** Maps the GraphQL input to the draft shift request of the workspace it names. */
export const toAddShiftsDraftShiftRequest = (
    workspaceId: string,
    input: AddShiftsDraftShiftInput,
): AddShiftsDraftShiftRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the draft shift removal request of the workspace it names. */
export const toRemoveShiftsDraftShiftRequest = (
    workspaceId: string,
    input: ShiftsShiftRefInput,
): RemoveShiftsDraftShiftRequest => ({ workspaceId, shiftId: input.shiftId })

/** Maps the GraphQL input to the publish request of the workspace it names. */
export const toRequestShiftsPublishRequest = (
    workspaceId: string,
    input: ShiftsScheduleRefInput,
): RequestShiftsPublishRequest => ({ workspaceId, scheduleId: input.scheduleId })

/** Maps the proposal outcome to the GraphQL type. */
export const toProposeWeekType = (result: ProposeWeekOutput): ProposeWeekType => ({
    scheduleId: result.scheduleId,
    version: result.version,
    shifts: result.shifts,
    open: result.open,
    short: result.short,
    costVnd: result.costVnd,
    ms: result.ms,
    iterations: result.iterations,
})

/** Maps the reassignment outcome to the GraphQL type. */
export const toReassignShiftsShiftType = (result: ReassignShiftOutput): ReassignShiftsShiftType => ({
    warnings: [...result.warnings],
})

/** Maps the explanation to the GraphQL type. */
export const toExplainScheduleType = (result: ExplainScheduleOutput): ExplainScheduleType => ({
    explanation: result.explanation,
})

/** Maps the decision status to the GraphQL type. */
export const toRequestStatusType = (result: RequestOutput): RequestStatusType => ({ status: result.status })
