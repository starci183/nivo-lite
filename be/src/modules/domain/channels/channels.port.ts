import type { ZaloFollowEventRow, ZaloInboxFactsRow } from "@modules/domain/zalo-inbox"

/** What the Zalo OA page reads from the webhook inbox: the port the zalo-inbox capability implements. */
export interface ZaloInboxReads {
    /** The newest follow events of a connection, newest first. */
    followEvents(connectionId: string): Promise<ReadonlyArray<ZaloFollowEventRow>>
    /** When the latest event arrived and whether a customer text and a follow event were seen; null when the inbox has no row of the connection. */
    factsOf(connectionId: string): Promise<ZaloInboxFactsRow | null>
}
