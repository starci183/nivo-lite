/** Input for save-booking-policy. */
export interface SaveBookingPolicyRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The cancellation notice window in hours. */
    readonly cancelWindowHours: number
    /** The required deposit percentage. */
    readonly depositPct: number
    /** The fee percentage for late cancellations. */
    readonly lateCancelFeePct: number
    /** The no-show fee in VND. */
    readonly noShowFeeVnd: number
    /** The minimum booking notice in minutes. */
    readonly minLeadMin: number
    /** The maximum advance booking window in days. */
    readonly maxAdvanceDays: number
    /** The interval between offered booking times in minutes. */
    readonly slotStepMin: number
    /** Whether available booking requests are confirmed automatically. */
    readonly autoConfirm: boolean
    /** Whether completed bookings create an order. */
    readonly handoffOrder: boolean
    /** The public booking address. */
    readonly address: string
    /** The IANA timezone used for bookings. */
    readonly timezone: string
}

/** Confirms where the policy change was persisted. */
export interface SaveBookingPolicyResult {
    /** Use this value to refresh the affected booking board. */
    readonly workspaceId: string
}
