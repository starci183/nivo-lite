import type { DownloadedChatFile } from "@modules/domain/chat-files"
import type { FrontAgent } from "./conversations.contracts"

/** Where a customer was met, and who answers them. */
export interface Meeting {
    /** The workspace. */
    readonly workspaceId: string
    /** The connection the message came through. */
    readonly connectionId: string
    /** The channel: telegram, zalo, facebook or instagram. */
    readonly channel: string
    /** The channel's id of the customer. */
    readonly customerId: string
    /** The name the conversation shows for the customer. */
    readonly visitor: string
    /** The front-door agent of the connection. */
    readonly agent: FrontAgent
}

/** A meeting with the words the customer wrote and the channel's own id of that message. */
export interface Hearing extends Meeting {
    /** What the customer wrote, as the turn reads it. */
    readonly text: string
    /** The channel's own id of the message, the key that stores it once in its conversation. */
    readonly channelEventId: string
    /** The pictures and files that came with the message, already read. */
    readonly files?: ReadonlyArray<DownloadedChatFile>
    /** When the channel says the customer sent it, in epoch milliseconds; absent or null stores it at the time it arrived. */
    readonly sentAt?: number | null
}
