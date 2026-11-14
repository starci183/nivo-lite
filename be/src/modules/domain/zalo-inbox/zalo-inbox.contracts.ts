export { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
export type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"

/** The transport may have no retained raw bytes. */
export type ZaloRawDelivery = Buffer | undefined

/** The door a Zalo event came through when it was not the webhook: `poll` (a reconcile run read it back) or `manual_import` (an owner's import, whose attachments may name local files). */
export type ZaloEventSource = "poll" | "manual_import"

/** The Zalo user message a reconcile run read back, in the terms the inbox stores. */
export interface PolledZaloMessage {
    /** Zalo's id of the message: the same id the webhook carries as `msg_id`. */
    readonly messageId: string
    /** The Zalo id of the customer who wrote. */
    readonly userId: string
    /** The name the OA's listing shows for the customer (`from_display_name`), or an empty text. */
    readonly userName: string
    /** What the customer wrote. */
    readonly text: string
    /** When the customer wrote it, in epoch milliseconds. */
    readonly sentAt: number
}

/** What the reconcile run needs to store a polled message: whose connection it is, the customer's name for the owner, and whether it is stale. */
export interface PolledZaloIntake {
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The name the owner sees the message under. */
    readonly sender: string
    /** True when the message is past the reply window or the stale age: it is kept for the owner and no agent answers it. */
    readonly stale: boolean
}

/** A Zalo user who wrote to the OA lately, from the stored inbound messages. */
export interface ZaloWriter {
    /** The Zalo user id. */
    readonly userId: string
    /** The name Zalo gave, or an empty text. */
    readonly name: string
    /** When they last wrote, ISO 8601. */
    readonly lastAt: string
}

/** What the account knows of a connection's events; null when it keeps no event, message or follower of it. */
export type OptionalZaloInboxFacts = ZaloInboxFactsRow | null

/** What the account knows of a connection's events. */
export interface ZaloInboxFactsRow {
    /** When the latest event or customer message arrived, ISO text. */
    readonly last_at: string | null
    /** A customer message arrived. */
    readonly has_text: boolean
    /** A person follows the OA. */
    readonly has_follow: boolean
}
