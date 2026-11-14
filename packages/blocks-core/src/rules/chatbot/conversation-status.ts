/** Where a conversation stands in the inbox: the AI answers, a customer waits for a person, or a person holds it. */
export type InboxStatus = "ai" | "needs" | "handled"

/** The inbox statuses in the order the inbox lists them. */
export const INBOX_STATUSES: readonly ["needs", "handled", "ai"] = ["needs", "handled", "ai"]

/**
 * The mark a chat STORES so the inbox filters, counts and sorts on it: a customer waits for a person (`needs`) or not (`ai`). Who holds
 * the thread is not the chat's: the staff hold is the engine's, on the route (ruling R43), so `handled` is only ever shown, never stored.
 */
export type ChatMark = "ai" | "needs"

/** The stored marks of a chat. */
export const CHAT_MARKS: readonly ["needs", "ai"] = ["needs", "ai"]

/** What decides the status a conversation is shown with. */
export interface ConversationFacts {
    /** Whether the AI handed a question to a person that is not answered yet. */
    readonly waiting: boolean
    /** Whether a staff member holds the route (the engine's hold, ruling R43). */
    readonly held: boolean
}

/** The status of a conversation: a customer waiting for a person first, then a person holding it, else the AI. */
export const inboxStatusOf = (facts: ConversationFacts): InboxStatus => {
    if (facts.waiting) return "needs"
    return facts.held ? "handled" : "ai"
}

/** The mark a chat stores for its open question. */
export const chatMarkOf = (waiting: boolean): ChatMark => (waiting ? "needs" : "ai")
