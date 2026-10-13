/** One signed delivery to a receiver. */
export interface WebhookPost {
    /** The resolved target. */
    readonly url: URL
    /** The headers, including the signature. */
    readonly headers: Readonly<Record<string, string>>
    /** The JSON text that was signed. */
    readonly body: string
}

/** What a delivery answered: the receiver's status, or why none arrived. */
export interface WebhookPostResult {
    /** The HTTP status the receiver answered, null when none did. */
    readonly status: number | null
    /** Why no status arrived. */
    readonly failure: "timeout" | "unreachable" | null
    /** How long it took, in milliseconds. */
    readonly durationMs: number
}
