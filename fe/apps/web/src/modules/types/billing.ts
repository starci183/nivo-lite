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

/** One plan as the catalogue draws it: settled copy and prices, never a computation. */
export interface PlanCardView {
    readonly id: string
    readonly name: string
    readonly isCurrent: boolean
    readonly price: string
    readonly isPriceLoading: boolean
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: "success" | "accent" | "neutral" }>
    readonly notes: ReadonlyArray<string>
    readonly facts: ReadonlyArray<string>
    readonly tier?:
        | {
              readonly label: string
              readonly value: string
              readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
          }
        | undefined
    readonly seats?: { readonly label: string; readonly value: number; readonly max: number } | undefined
    readonly action: {
        readonly kind: "checkout" | "contact"
        readonly label: string
        readonly href: string
        readonly isPending: boolean
        readonly isDisabled: boolean
    }
}

/** An audience group of plans with its header. */
export interface PlanGroupView {
    readonly id: string
    readonly title: string
    readonly text: string
    readonly cards: ReadonlyArray<PlanCardView>
}
