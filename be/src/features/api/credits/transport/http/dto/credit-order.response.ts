/** The bank account a transfer goes to. */
export class CreditOrderBankResponse {
    /** The account number. */
    readonly account!: string
    /** The bank short code. */
    readonly bank!: string
    /** The account holder. */
    readonly holder!: string
}

/** One payment order. */
export class CreditOrderLineResponse {
    /** The order id. */
    readonly id!: string
    /** The workspace that pays. */
    readonly workspaceId!: string
    /** The plan code on the order. */
    readonly planCode!: string
    /** The amount to transfer in VND. */
    readonly amountVnd!: number
    /** The transfer content. */
    readonly orderCode!: string
    /** `pending`, `paid`, `expired` or `cancelled`. */
    readonly status!: string
    /** When the order stops being payable, ISO 8601. */
    readonly expiresAt!: string
    /** When it was paid, ISO 8601, or null. */
    readonly paidAt!: string | null
    /** When it was created, ISO 8601. */
    readonly createdAt!: string
    /** `plan`, `upgrade` or `topup`. */
    readonly kind!: string
    /** The credit pack of a top-up, or null. */
    readonly packCode!: string | null
    /** What was sold, frozen when the order was made. */
    readonly detail!: Readonly<Record<string, unknown>>
}

/** A payment order with what the customer needs to pay it. */
export class CreditOrderResponse {
    /** The order. */
    readonly order!: CreditOrderLineResponse
    /** The VietQR image that pays the order. */
    readonly qrUrl!: string
    /** The bank account of the transfer. */
    readonly bank!: CreditOrderBankResponse
}
