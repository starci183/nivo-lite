/** The statuses of an order that waits for money. */
export const AWAITING_PAYMENT: ReadonlyArray<string> = ["confirmed", "invoiced"]

/** One bank transaction as the `bank-transaction` data kind yields it (instants as ISO text). */
export type TransactionRow = {
    /** The id of the row. */
    readonly id: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The transfer content the bank recorded. */
    readonly reference: string
    /** The name of the sender the bank recorded, or null. */
    readonly payer: string | null
    /** When the money arrived, as ISO text. */
    readonly occurredAt: string
    /** The order the transaction is linked to, or null. */
    readonly orderId: string | null
    /** The status of the transaction. */
    readonly status: string
}

/** One sales order as the `order` data kind yields it. */
export type OrderRow = {
    /** The id of the row. */
    readonly id: string
    /** The number the customer is told. */
    readonly orderNo: string
    /** The customer the row belongs to. */
    readonly leadId: string
    /** The items the customer named. */
    readonly items: ReadonlyArray<Readonly<Record<string, unknown>>>
    /** The amount in VND. */
    readonly amountVnd: number | null
    /** The status of the row. */
    readonly status: string
    /** When the order was confirmed, or null. */
    readonly confirmedAt: string | null
    /** When the order was created, as ISO text. */
    readonly createdAt: string
}

/** One customer as the `sales-lead` data kind yields it. */
export type LeadRow = {
    /** The id of the row. */
    readonly id: string
    /** The name of the customer, or null. */
    readonly contactName: string | null
}

/** One customer payment claim as the `payment-claim` data kind yields it. */
export type ClaimRow = {
    /** The id of the row. */
    readonly id: string
    /** The customer the row belongs to. */
    readonly leadId: string | null
    /** The conversation the claim came in, or null. */
    readonly conversationId: string | null
    /** The amount in VND the customer said, or null. */
    readonly amountVnd: number | null
    /**
     * The names the customer wrote with the claim, as the claim record stores them (`{ values: [...] }`, a jsonb field holds no bare
     * list); a plain list is read too. Read it through `claimNamesOf`.
     */
    readonly names: StoredClaimNames
    /** The text of the row. */
    readonly body: string
    /** When the customer claimed, as ISO text. */
    readonly claimedAt: string
    /** The status of the claim. */
    readonly status: string
}

/** An instant as epoch milliseconds. */
export const atOf = (value: string): number => Date.parse(value)

/** The names of a claim as a record may hold them: the stored `{ values }`, a plain list, or nothing. */
export type StoredClaimNames = ReadonlyArray<string> | { readonly values?: ReadonlyArray<string> | undefined } | null

/** The names of a claim as a list, whatever shape the record holds them in; nothing readable is no name. */
export const claimNamesOf = (stored: StoredClaimNames): ReadonlyArray<string> => {
    const list: unknown = Array.isArray(stored) ? stored : stored?.values
    return Array.isArray(list) ? list.filter((name): name is string => typeof name === "string") : []
}
