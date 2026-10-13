import type { SaveBookingPolicyRequest, SaveBookingPolicyResult } from "../../application/save-booking-policy.contracts"
import type { SaveBookingPolicyInput } from "./dto/save-booking-policy.input"
import type { SaveBookingPolicyType } from "./dto/save-booking-policy.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toSaveBookingPolicyRequest = (
    workspaceId: string,
    input: SaveBookingPolicyInput,
): SaveBookingPolicyRequest => ({
    workspaceId,
    cancelWindowHours: input.cancelWindowHours,
    depositPct: input.depositPct,
    lateCancelFeePct: input.lateCancelFeePct,
    noShowFeeVnd: input.noShowFeeVnd,
    minLeadMin: input.minLeadMin,
    maxAdvanceDays: input.maxAdvanceDays,
    slotStepMin: input.slotStepMin,
    autoConfirm: input.autoConfirm,
    handoffOrder: input.handoffOrder,
    address: input.address,
    timezone: input.timezone,
})

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingPolicyType = (result: SaveBookingPolicyResult): SaveBookingPolicyType => ({
    workspaceId: result.workspaceId,
})
