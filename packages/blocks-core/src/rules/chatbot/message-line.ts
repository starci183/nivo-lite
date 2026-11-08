import { authorKindOf, deliveryWordOf, markOf, roleOf, sideOf, type DeliveryWord, type MessageSide } from "./message"

/** The name an AI line carries when it has no author name of its own. */
export const AI_AUTHOR = "AI"

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
    }
}
