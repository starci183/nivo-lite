/** The key of a webhook sender or the key configured for it; undefined when there is none. */
export type OptionalApiKey = string | undefined

/** The raw bytes of a delivery body, when the transport kept them. */
export type OptionalRawBody = Buffer | undefined

/** The intake a delivery runs, which the connection page traces around. */
export type IntakeRun = () => Promise<void>

/** What a delivery reads to: its fields, or undefined when it has no safe integer id. */
export type OptionalSepayPayload = SepayPayload | undefined

/** The amount of a transfer in VND; null when the payer types it. */
export type OptionalAmountVnd = number | null

/** The SePay webhook body reduced to the fields NIVO reads (names exactly as in https://docs.sepay.vn); only `id` is required. */
export interface SepayPayload {
    /** The SePay transaction id: the idempotency key. */
    readonly id: number
    /** The bank gateway name. */
    readonly gateway: string | undefined
    /** `in` for a credit, `out` for a debit. */
    readonly transferType: string | undefined
    /** The amount in VND; 0 when absent, undefined when unreadable. */
    readonly transferAmount: number | undefined
    /** The transfer content. */
    readonly content: string | null
    /** The payment code SePay extracted from the content. */
    readonly code: string | null
    /** The SePay description line. */
    readonly description: string | null
    /** The bank account number the transfer belongs to. */
    readonly accountNumber: string | undefined
    /** When the bank booked the transfer, as SePay writes it (`2026-11-05 14:02:37`, Vietnam time). */
    readonly transactionDate: string | undefined
    /** The bank's own reference of the transfer (`referenceCode`, e.g. `FT25309…`), trimmed; undefined when absent or empty. */
    readonly referenceCode?: string | undefined
}
