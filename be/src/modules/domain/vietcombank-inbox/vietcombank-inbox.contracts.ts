/** A normalized simulated credit retained for deferred booking. */
export interface SimulatedReceiptCredit {
    /** The amount in VND. */
    readonly amount: number
    /** The transfer content. */
    readonly content: string
    /** The payer, when known. */
    readonly sender: string | null
    /** The original bank event identity. */
    readonly eventId: string
}

/** The payload stored for one simulated-bank receipt. */
export interface SimulatedReceiptPayload {
    /** The destination workspace. */
    readonly workspaceId: string
    /** The validated bank credit. */
    readonly credit: SimulatedReceiptCredit
}

/** A pending receipt held by the caller's transaction lock. */
export interface PendingVietcombankInboxReceipt {
    /** The row to complete after successful booking. */
    readonly id: string
    /** The immutable receipt data. */
    readonly payload: SimulatedReceiptPayload
}

/** A pending receipt, or undefined when it is absent or already complete. */
export type VietcombankInboxReceiptLookup = PendingVietcombankInboxReceipt | undefined
