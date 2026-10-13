/** The flags of the simulate-sepay command, as the command line gave them. */
export interface SimulationFlags {
    /** SePay transaction id; a repeated id repeats a delivery (idempotency check). Defaults to the clock. */
    readonly id?: string
    /** The url to post to instead of the configured one. */
    readonly url?: string
    /** Sends a debit (`out`), which the door must ignore. */
    readonly out?: boolean
}

/** What one simulated delivery asks for. */
export interface SimulationRequest {
    /** The order code the transfer content names. */
    readonly orderCode: string
    /** The transferred amount in VND. */
    readonly amount: number
    /** SePay transaction id; defaults to the clock. */
    readonly transactionId: number | undefined
    /** Sends a debit (`out`), which the door must ignore. */
    readonly debit: boolean
}

/** The body SePay posts for a bank transaction (names exactly as in https://docs.sepay.vn). */
export interface SimulatedSepayBody {
    /** SePay transaction id. */
    readonly id: number
    /** The bank gateway. */
    readonly gateway: string
    /** The transaction time, Vietnam time. */
    readonly transactionDate: string
    /** The account number. */
    readonly accountNumber: string
    /** The sub account. */
    readonly subAccount: null
    /** The payment code SePay extracted. */
    readonly code: null
    /** The transfer content. */
    readonly content: string
    /** `in` or `out`. */
    readonly transferType: "in" | "out"
    /** SePay description line. */
    readonly description: string
    /** The amount in VND. */
    readonly transferAmount: number
    /** The bank reference. */
    readonly referenceCode: string
    /** The running balance. */
    readonly accumulated: number
}

/** The bank account the simulated payload reports. */
export interface SimulatedAccount {
    /** The bank gateway name. */
    readonly bankCode: string
    /** The account number. */
    readonly bankAccount: string
}
