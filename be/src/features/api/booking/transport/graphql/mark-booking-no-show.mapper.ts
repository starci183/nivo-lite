import type { MarkNoShowRequest, MarkNoShowResult } from "../../application/mark-no-show.contracts"
import type { MarkBookingNoShowInput } from "./dto/mark-booking-no-show.input"
import type { MarkBookingNoShowType } from "./dto/mark-booking-no-show.type"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toMarkBookingNoShowRequest = (workspaceId: string, input: MarkBookingNoShowInput): MarkNoShowRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the application result to the GraphQL type. */
export const toMarkBookingNoShowType = (result: MarkNoShowResult): MarkBookingNoShowType => ({
    status: result.status,
    feeDue: result.feeDue,
})
