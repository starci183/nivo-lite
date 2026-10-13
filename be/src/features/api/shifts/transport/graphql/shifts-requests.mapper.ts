import type { RequestOutput } from "@modules/domain/shifts"
import type { RequestShiftsLeaveRequest } from "../../application/request-shifts-leave.contracts"
import type { RequestShiftsSwapRequest } from "../../application/request-shifts-swap.contracts"
import type { RequestShiftsLeaveInput } from "./dto/request-shifts-leave.input"
import type { RequestShiftsSwapInput } from "./dto/request-shifts-swap.input"
import type { RequestStatusType } from "./dto/request-status.type"

/** Maps the GraphQL input to the swap or claim request of the workspace it names. */
export const toRequestShiftsSwapRequest = (
    workspaceId: string,
    input: RequestShiftsSwapInput,
): RequestShiftsSwapRequest => ({
    workspaceId,
    kind: input.kind,
    shiftId: input.shiftId,
    toStaffId: input.toStaffId ?? null,
    reason: input.reason,
})

/** Maps the GraphQL input to the leave request of the workspace it names. */
export const toRequestShiftsLeaveRequest = (
    workspaceId: string,
    input: RequestShiftsLeaveInput,
): RequestShiftsLeaveRequest => ({ workspaceId, ...input })

/** Maps the decision status to the GraphQL type. */
export const toRequestStatusType = (result: RequestOutput): RequestStatusType => ({ status: result.status })
