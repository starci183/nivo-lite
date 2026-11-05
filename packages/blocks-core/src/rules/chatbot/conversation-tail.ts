import { PREVIEW_MAX, previewOf } from "./message"
import type { MessageRole } from "./message"

/** What a conversation keeps of its lines so the inbox lists it without reading them: written with every line. */
export interface ConversationTail {
    /** The preview of the last spoken line (or of the last system line while nobody spoke); empty before any line. */
    readonly lastText: string
    /** The role of the last spoken line, not counting system lines; null before anyone spoke. */
    readonly lastRole: MessageRole | null
    /** The moment of the last line of any role, as ISO 8601; null before any line. */
    readonly lastAt: string | null
    /** How many spoken lines the conversation holds, not counting system lines. */
    readonly messageCount: number
}

/** The line that was just stored. */
export interface TailLine {
    /** The role of the line. */
    readonly role: MessageRole
    /** The words of the line. */
    readonly text: string
    /** The moment of the line, as ISO 8601. */
    readonly at: string
}

/** A conversation before its first line. */
export const EMPTY_TAIL: ConversationTail = { lastText: "", lastRole: null, lastAt: null, messageCount: 0 }

/** The longest `lastText` a tail holds: the preview limit, plus the ellipsis the preview adds. */
export const TAIL_TEXT_MAX: number = PREVIEW_MAX + 2

/**
 * The tail after one more line. A spoken line becomes the preview and counts; a system line moves the time and is the preview only
 * while nobody has spoken, so the list shows what was said, not that a person took over.
 */
export const tailAfter = (tail: ConversationTail, line: TailLine): ConversationTail => {
    if (line.role === "system") {
        return {
            ...tail,
            lastAt: line.at,
            lastText: tail.lastRole === null ? previewOf(line.text) : tail.lastText,
        }
    }
    return {
        lastText: previewOf(line.text),
        lastRole: line.role,
        lastAt: line.at,
        messageCount: tail.messageCount + 1,
    }
}
