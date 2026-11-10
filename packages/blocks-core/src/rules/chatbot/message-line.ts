import { authorKindOf, deliveryWordOf, markOf, roleOf, sideOf } from "./message"
import type { DeliveryWord, MessageSide } from "./message"

/** The name an AI line carries when it has no author name of its own. */
export const AI_AUTHOR = "AI"

/** A picture or file a line carries: a photo, an album frame, a payment QR. */
export interface LineFile {
    /** The id of the file. */
    readonly id: string
    /** Where the file is served from. */
    readonly url: string
    /** The name of the file, which names its link. */
    readonly name: string
    /** The media type, which tells a picture from another file. */
    readonly contentType: string
}

/** One ordered item on an order card of a line: the name, how many, the price of one and of the line in words, and the photo of the catalogue item. */
export interface LineOrderItem {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
    /** The price of one with its currency; absent while the order has no price for it. */
    readonly unitText?: string | undefined
    /** What the line comes to with its currency; absent while unknown. */
    readonly amountText?: string | undefined
    /** The photo of the catalogue item; absent draws a sprout. */
    readonly imageUrl?: string | null | undefined
}

/** The order a line is about, as the customer saw it: a snapshot taken when the line was sent. */
export interface LineOrder {
    /** The order number. */
    readonly orderNo: string
    /** One entry per ordered item. */
    readonly lines: ReadonlyArray<LineOrderItem>
    /** The total with its currency. */
    readonly amountText: string
    /** The delivery line (where to deliver); empty when unknown. */
    readonly address: string
    /** Whether the order was paid when the line was sent. */
    readonly paid: boolean
}

/** One stored line of a conversation. */
export interface StoredLine {
    /** The id of the line. */
    readonly id: string
    /** The role of the line: `user`, `agent` or `system`. */
    readonly role: string
    /** The words of the line. */
    readonly text: string
    /** When the line was written, as ISO 8601. */
    readonly sentAt: string
    /** `human` when a person wrote an agent line, `ai` when the AI did. */
    readonly authorKind: string | null
    /** The name of the person who wrote an agent line. */
    readonly authorName: string | null
    /** The state of the push to the channel: `sent` or `failed`; null when none was made. */
    readonly deliveryStatus: string | null
    /** The agent that sent an agent line; null for the other lines and for lines from before it was kept. */
    readonly sentBy: string | null
    /** The pictures and files the line carries; absent when it carries none. */
    readonly files?: ReadonlyArray<LineFile> | undefined
    /** The order the line is about; absent when it is about none. */
    readonly order?: LineOrder | undefined
}

/** One line of the thread as the conversation block reads it (its paths: id, text, who, at, side, state, mark, sentBy). */
export interface ThreadLine {
    /** The id of the line. */
    readonly id: string
    /** The words of the line. */
    readonly text: string
    /** Who wrote it; empty for a line the system adds. */
    readonly who: string
    /** When it was written, as ISO 8601. */
    readonly at: string
    /** Whose line it is. */
    readonly side: MessageSide
    /** How far a line of the agent travelled; empty for the rest. */
    readonly state: DeliveryWord
    /** The short marker beside the author; empty draws none. */
    readonly mark: string
    /** The agent that sent the line; empty for a line no agent sent. */
    readonly sentBy: string
    /** The pictures and files of the line; absent when it carries none. */
    readonly files?: ReadonlyArray<LineFile>
    /** The order the line is about, for the order card; absent when it is about none. */
    readonly order?: LineOrder
}

/** Who wrote a line: the customer by the name the inbox shows, a person by their name, the AI by its own name. */
const whoOf = (line: StoredLine, customer: string): string => {
    const role = roleOf(line.role)
    if (role === "system") return ""
    return role === "user" ? customer : (line.authorName ?? AI_AUTHOR)
}

/** The thread line of a stored line. */
export const threadLineOf = (line: StoredLine, customer: string): ThreadLine => {
    const role = roleOf(line.role)
    const authorKind = authorKindOf(line.authorKind)
    return {
        id: line.id,
        text: line.text,
        who: whoOf(line, customer),
        at: line.sentAt,
        side: sideOf(role),
        state: deliveryWordOf(role, authorKind, line.deliveryStatus),
        mark: markOf(role, authorKind),
        sentBy: line.sentBy ?? "",
        ...(line.files === undefined || line.files.length === 0 ? {} : { files: line.files }),
        ...(line.order === undefined ? {} : { order: line.order }),
    }
}
