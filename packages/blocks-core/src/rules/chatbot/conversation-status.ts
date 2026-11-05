import type { MessageRole } from "./message"

/** Where a conversation stands in the inbox: the AI answers, a customer waits for a person, or a person holds it. */
export type InboxStatus = "ai" | "needs" | "handled"

/** The inbox statuses in the order the inbox lists them. */
export const INBOX_STATUSES: readonly ["needs", "handled", "ai"] = ["needs", "handled", "ai"]

/** What decides the status and the unanswered mark of a conversation. */
export interface ConversationFacts {
    /** Whether the AI handed a question to a person that is not answered yet. */
    readonly waiting: boolean
    /** The person who holds the conversation; null while the AI answers. */
    readonly handledBy: string | null
    /** The role of the last spoken line, not counting system lines; null before anyone spoke. */
    readonly lastRole: MessageRole | null
}

/** The status of a conversation: a customer waiting for a person first, then a person holding it, else the AI. */
export const inboxStatusOf = (facts: Pick<ConversationFacts, "waiting" | "handledBy">): InboxStatus => {
    if (facts.waiting) return "needs"
    return facts.handledBy === null ? "ai" : "handled"
}

/** Whether the customer wrote last and a person is needed: the question waits, or a person holds the conversation. */
export const unansweredOf = (facts: ConversationFacts): boolean =>
    facts.lastRole === "user" && (facts.waiting || facts.handledBy !== null)
