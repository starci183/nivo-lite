/**
 * Presentation data of the Chatbot inbox. Generated GraphQL payloads are normalized by the connected data hook.
 */

/** The channel a customer wrote from. */
export type ChatbotChannel = "telegram" | "zalo" | "facebook" | "instagram" | "website"

/** Whether a pushed reply reached the customer's channel, or nothing was pushed. */
export type ChatbotDelivery = "sent" | "failed" | null

/** Who wrote a message line. */
export type ChatbotRole = "user" | "agent" | "system"

/** One line of a conversation. */
export interface ChatbotMessage {
    readonly id: string
    readonly role: ChatbotRole
    /** For role "agent": a person wrote it ("human") or the AI did ("ai"). */
    readonly authorKind: "ai" | "human"
    readonly authorName: string | null
    readonly body: string
    readonly createdAt: string
    readonly delivery: ChatbotDelivery
    /** Why a push failed (a stable code, e.g. zalo_window_expired). */
    readonly deliveryError: string | null
}

/** One customer conversation as the list shows it. */
export interface ChatbotConversation {
    readonly id: string
    readonly channel: ChatbotChannel
    readonly name: string
    readonly leadId: string | null
    readonly lastText: string
    readonly lastRole: ChatbotRole | null
    readonly lastAt: string
    readonly messageCount: number
    readonly handledBy: string | null
    readonly waiting: boolean
    /** The customer wrote last and nobody (AI or person) has answered yet. */
    readonly unanswered: boolean
}

/** The figures above the inbox. */
export interface ChatbotMetrics {
    readonly today: number
    readonly waiting: number
    /** Median (p50) minutes from a customer's first message to the first reply, last 30 days; null when nothing to compute from. */
    readonly p50FirstResponseMin: number | null
    readonly sample: number
    /** Leads captured by the Chatbot: leads created in the last 7 days that came out of one of its customer conversations. */
    readonly leadsCaptured7d: number
}

/** The lead behind a conversation. */
export interface ChatbotLead {
    readonly id: string
    readonly name: string
    readonly company: string
    readonly stage: string
    readonly need: string
    readonly phone: string | null
    readonly email: string | null
}

/** A question the AI could not answer and handed to a person. */
export interface ChatbotEscalation {
    readonly workItemId: string
    readonly question: string
    readonly draft: string
    readonly staffName: string | null
    readonly since: string
}

/** One conversation with its lines, lead and open escalation. */
export interface ChatbotThread {
    readonly conversation: ChatbotConversation
    readonly messages: ReadonlyArray<ChatbotMessage>
    readonly lead: ChatbotLead | null
    readonly escalation: ChatbotEscalation | null
    readonly externalId: string | null
    readonly handledAt: string | null
}

/** The conversations of one Chatbot instance, newest activity first, with the header figures. */
export interface ChatbotOverview {
    readonly workspaceId: string
    readonly nowIso: string
    readonly conversations: ReadonlyArray<ChatbotConversation>
    readonly metrics: ChatbotMetrics
}
