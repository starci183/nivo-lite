/** What the webhook inbox knows of a connection. */
export interface ZaloInboxFactsRow {
    /** When the latest event arrived. */
    readonly last_at: string | null
    /** A customer text arrived. */
    readonly has_text: boolean
    /** A follow event arrived. */
    readonly has_follow: boolean
}

/** What the inbox knows of a connection; null when the inbox has no row of it. */
export type OptionalZaloInboxFacts = ZaloInboxFactsRow | null

/** What the Zalo OA page reads from the webhook inbox: the port the zalo-inbox capability implements. */
export interface ZaloInboxReads {
    /** When the latest event arrived and whether a customer text and a follow event were seen; null when the inbox has no row of the connection. */
    factsOf(connectionId: string): Promise<OptionalZaloInboxFacts>
}
