/** A code issued to a customer; the plain code leaves through the customer's own chat and is never stored. */
export interface IssuedCode {
    /** The id of the stored hash, kept to discard the code when it cannot be delivered. */
    readonly id: string
    /** The six digits. */
    readonly code: string
}

/** What a code check came to. */
export type CodeCheck = "accepted" | "rejected"
