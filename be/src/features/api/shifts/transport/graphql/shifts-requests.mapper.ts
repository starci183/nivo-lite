import type { RequestOutput } from "@modules/domain/shifts"
import type { RequestShiftsLeaveRequest } from "../../application/request-shifts-leave.contracts"
import type { RequestShiftsLeaveInput } from "./dto/request-shifts-leave.input"
import type { RequestStatusType } from "./dto/request-status.type"

/** Maps the GraphQL input to the swap or claim request of the workspace it names. */
export { toRequestShiftsSwapRequest } from "@modules/domain/shifts"

/** Maps the GraphQL input to the leave request of the workspace it names. */
export const toRequestShiftsLeaveRequest = (
    workspaceId: string,
    input: RequestShiftsLeaveInput,
): RequestShiftsLeaveRequest => ({ workspaceId, ...input })

/** Maps the decision status to the GraphQL type. */
export const toRequestStatusType = (result: RequestOutput): RequestStatusType => ({ status: result.status })
