import type { GapRecord } from "@modules/domain/knowledge-gaps"

/** The channel a customer wrote from. */
export type ChatbotChannel = "telegram" | "zalo" | "facebook" | "instagram" | "website"

/** Whether a pushed reply reached the customer's channel, or nothing was pushed. */
export type ChatbotDelivery = "sent" | "failed" | null

/** Who wrote a message line. */
export type ChatbotRole = "user" | "agent" | "system"

/** One line of a conversation. */
export interface ChatbotMessage {
    /** The id value. */
    readonly id: string
    /** The role value. */
    readonly role: ChatbotRole
    /** For role "agent": a person wrote it ("human") or the AI did ("ai"). */
    readonly authorKind: "ai" | "human"
    /** The author name value. */
    readonly authorName: string | null
    /** The body value. */
    readonly body: string
    /** The created at value. */
    readonly createdAt: string
    /** The delivery value. */
    readonly delivery: ChatbotDelivery
    /** Why a push failed (a stable code, e.g. zalo_window_expired). */
    readonly deliveryError: string | null
}

/** The customer record behind a conversation, as the list shows it: where the deal stands and what the customer needs. */
export interface ChatbotConversationLead {
    /** The journey stage of the customer (`leads.stage`). */
    readonly stage: string
    /** What the customer needs. */
    readonly need: string
    /** The customer's company, empty when unknown. */
    readonly company: string
}

/** Who answers the customer next: the AI of this desk, a person who holds the chat, or the other agent a hand-over moved it to. */
export interface ChatbotRespondent {
    /** `ai` for the AI of this desk, `person` for a staff member who holds the chat, `agent` for the other agent of a hand-over. */
    readonly kind: "ai" | "person" | "agent"
    /** The person or the agent; null for the AI of this desk. */
    readonly name: string | null
}

/** One customer conversation as the list shows it. */
export interface ChatbotConversation {
    /** The id value. */
    readonly id: string
    /** The channel value. */
    readonly channel: ChatbotChannel
    /** The name value. */
    readonly name: string
    /** The lead id value. */
    readonly leadId: string | null
    /** The last text value. */
    readonly lastText: string
    /** The last role value. */
    readonly lastRole: ChatbotRole | null
    /** The last at value. */
    readonly lastAt: string
    /** The message count value. */
    readonly messageCount: number
    /** The handled by value. */
    readonly handledBy: string | null
    /** The waiting value. */
    readonly waiting: boolean
    /** The customer wrote last and nobody (AI or person) has answered yet. */
    readonly unanswered: boolean
    /** The customer record, null while the customer was not captured. */
    readonly lead: ChatbotConversationLead | null
    /** Who answers next. */
    readonly respondent: ChatbotRespondent
}

/** The figures above the inbox. */
export interface ChatbotMetrics {
    /** The today value. */
    readonly today: number
    /** The waiting value. */
    readonly waiting: number
    /** Median (p50) minutes from a customer's first message to the first reply, last 30 days; null when nothing to compute from. */
    readonly p50FirstResponseMin: number | null
    /** The sample value. */
    readonly sample: number
    /** Leads captured by the Chatbot: leads created in the last 7 days that came out of one of its customer conversations. */
    readonly leadsCaptured7d: number
}

/** The lead behind a conversation. */
export interface ChatbotLead {
    /** The id value. */
    readonly id: string
    /** The name value. */
    readonly name: string
    /** The company value. */
    readonly company: string
    /** The stage value. */
    readonly stage: string
    /** The need value. */
    readonly need: string
    /** The phone value. */
    readonly phone: string | null
    /** The email value. */
    readonly email: string | null
}

/** A question the AI could not answer and handed to a person. */
export interface ChatbotEscalation {
    /** The work item id value. */
    readonly workItemId: string
    /** The question value. */
    readonly question: string
    /** The draft value. */
    readonly draft: string
    /** The staff name value. */
    readonly staffName: string | null
    /** The since value. */
    readonly since: string
}

/** One conversation with its lines, lead and open escalation. */
export interface ChatbotThread {
    /** The conversation value. */
    readonly conversation: ChatbotConversation
    /** The messages value. */
    readonly messages: ReadonlyArray<ChatbotMessage>
    /** The lead value. */
    readonly lead: ChatbotLead | null
    /** The escalation value. */
    readonly escalation: ChatbotEscalation | null
    /** The external id value. */
    readonly externalId: string | null
    /** The handled at value. */
    readonly handledAt: string | null
}

/** A customer reply that waits for a person: the question, the AI's draft and who was asked. */
export interface ChatbotWaiting {
    /** The work item that waits. */
    readonly workItemId: string
    /** The conversation it answers in. */
    readonly conversationId: string
    /** The channel of that conversation. */
    readonly channel: ChatbotChannel
    /** The customer's name as the list shows it. */
    readonly name: string
    /** What the customer asked. */
    readonly question: string
    /** The AI's draft answer, empty when it wrote none. */
    readonly draft: string
    /** The staff member the reply was assigned to, when assigned. */
    readonly staffName: string | null
    /** When it began to wait. */
    readonly since: string
}

/** The conversations of one Chatbot instance, newest activity first, with the header figures. */
export interface ChatbotOverview {
    /** The workspace id value. */
    readonly workspaceId: string
    /** The now iso value. */
    readonly nowIso: string
    /** The conversations value. */
    readonly conversations: ReadonlyArray<ChatbotConversation>
    /** The metrics value. */
    readonly metrics: ChatbotMetrics
    /** The customer replies that wait for a person, oldest first. */
    readonly waiting: ReadonlyArray<ChatbotWaiting>
}

/** Which workspace and installation's customer inbox to inspect. */
export interface ChatbotOverviewRequest {
    /** The authorized workspace selector. */
    readonly workspaceId: string
    /** Null combines every Chatbot agent, including legacy installations. */
    readonly installationId?: string | null | undefined
}

/** An active catalog agent through which the brain may be viewed. */
export interface ChatbotLens {
    /** The module catalog key. */
    readonly module: string
    /** The agent's display name. */
    readonly name: string
    /** Whether the agent speaks to customers or the business. */
    readonly audience: "customer" | "internal"
}

/** The unanswered customer questions and available agent lenses. */
export interface ChatbotGaps {
    /** The open knowledge gaps, most asked first. */
    readonly gaps: ReadonlyArray<GapRecord>
    /** One active agent per known module. */
    readonly lenses: ReadonlyArray<ChatbotLens>
}
