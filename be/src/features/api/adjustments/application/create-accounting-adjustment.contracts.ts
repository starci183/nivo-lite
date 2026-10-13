import type { NewAccountingAdjustment } from "@modules/domain/accounting-adjustments"

/** The member-scoped append-only correction request. */
export interface CreateAccountingAdjustmentRequest extends NewAccountingAdjustment {
    /** The selected workspace. */
    readonly workspaceId: string
}
