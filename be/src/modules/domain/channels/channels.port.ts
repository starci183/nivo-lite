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

/** A Zalo user who wrote to the OA lately, from the engine's stored inbound messages. */
export interface ZaloWriter {
    /** The Zalo user id. */
    readonly userId: string
    /** The name Zalo gave, or an empty text. */
    readonly name: string
    /** When they last wrote, ISO 8601. */
    readonly lastAt: string
}

/** What the Zalo OA page reads from the webhook inbox: the port the zalo-inbox capability implements. */
export interface ZaloInboxReads {
    /** When the latest event arrived and whether a customer text and a follow event were seen; null when the inbox has no row of the connection. */
    factsOf(connectionId: string): Promise<OptionalZaloInboxFacts>
    /** The people who wrote to the OA after a moment, newest first, one per Zalo user, at most `limit`: read from the stored inbound messages, never from a conversation. */
    writersSince(connectionId: string, since: Date, limit: number): Promise<ReadonlyArray<ZaloWriter>>
}
