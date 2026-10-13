import { CreditOrderResponse } from "./credit-order.response"

/** The figures an upgrade order froze. */
export class UpgradeQuoteResponse {
    /** What the buyer pays now in VND. */
    readonly amount!: number
    /** The unused value of the current plan that was deducted, in VND. */
    readonly credit!: number
    /** The days that unused value is worth. */
    readonly daysLeft!: number
    /** The plan the workspace moves from. */
    readonly fromCode!: string
}

/** An upgrade order with the figures it froze. */
export class UpgradeOrderResponse {
    /** The order with the QR that pays it. */
    readonly payable!: CreditOrderResponse
    /** The figures of the order. */
    readonly quote!: UpgradeQuoteResponse
}
