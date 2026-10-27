/** The tone a billing status badge takes. */
export type BillingTone = "success" | "warning" | "danger" | "neutral"

/** The current plan card, worded and ready to draw. */
export interface BillingPlanView {
    readonly planName: string
    readonly status: string
    readonly statusTone: BillingTone
    readonly paidUntil: string
    readonly canRenew: boolean
}

/** One formatted row of the payment history or of the transfers held for review. */
export interface BillingRowView {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly content?: string | undefined
    readonly status?: { readonly label: string; readonly tone: BillingTone }
}
