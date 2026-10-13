import type { PlanSelectionInput } from "@modules/domain/billing"

/** Arguments for billingPlanQuote. */
export interface BillingPlanQuoteRequest {
    /** The workspace that would pay. */
    readonly workspaceId: string
    /** The plan to price. */
    readonly planCode: string
    /** The cycle, usage tier and seats to price. */
    readonly selection: PlanSelectionInput
}
