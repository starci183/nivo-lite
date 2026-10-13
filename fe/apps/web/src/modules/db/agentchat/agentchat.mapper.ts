/** Which of the two conversations of an agent the owner is looking at: their own test, or the simulated website customer. */
export type AgentChatKind = "test" | "customer"

/** One conversation of an agent, as the history list shows it. */
export interface AgentChatConversation {
    readonly id: string
    readonly kind: AgentChatKind
    /** The channel the customer wrote on: website, telegram, zalo and so on. */
    readonly channel: string
    readonly visitorName: string | null
    /** The lead the conversation produced, when it produced one. */
    readonly leadId: string | null
    /** Who holds the conversation instead of the AI; null while the AI answers. */
    readonly handledBy: string | null
    readonly createdAt: string
}

/** One message of a conversation. */
export interface AgentChatMessage {
    readonly id: string
    readonly role: "user" | "agent" | "system"
    readonly body: string
    readonly createdAt: string
}

const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/u

/** True for a well-formed uuid; nothing else reaches the database as an id. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** Narrows a stored kind text to the two kinds the chat knows. */
export const kindOf = (value: string): AgentChatKind => (value === "customer" ? "customer" : "test")

/** Narrows a stored role text to the three roles a thread draws. */
export const roleOf = (value: string): AgentChatMessage["role"] =>
    value === "user" || value === "system" ? value : "agent"

/** What the owner asks of the chat: open a conversation. */
export interface StartConversationInput {
    readonly agentId: string
    readonly kind: AgentChatKind
    /** The visitor the owner plays in a customer conversation; null for the default. */
    readonly visitorName: string | null
}

/** What the owner asks of the chat: write a message. */
export interface SendMessageInput {
    readonly conversationId: string
    readonly body: string
}

/** What the owner asks of the chat: take a conversation over or hand it back, with the line the thread records. */
export interface TakeOverInput {
    readonly conversationId: string
    readonly take: boolean
    readonly line: string
}

/** Which part of the input a refusal names. */
export type AgentChatField = "input" | "agent" | "kind" | "conversation" | "body"

/** The answer of a schema: the parsed data, or the part of the input that was refused. */
export type AgentChatParse<Data> =
    { readonly success: true; readonly data: Data } | { readonly success: false; readonly field: AgentChatField }

const BODY_MAX = 4000
const VISITOR_MAX = 80
const LINE_MAX = 400

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Bounds the request to open a conversation before anything reads it. */
export const startConversationSchema = {
    safeParse: (input: unknown): AgentChatParse<StartConversationInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        if (!isUuid(input.agentId)) return { success: false, field: "agent" }
        if (input.kind !== "test" && input.kind !== "customer") return { success: false, field: "kind" }
        const name = typeof input.visitorName === "string" ? input.visitorName.trim().slice(0, VISITOR_MAX) : ""
        return {
            success: true,
            data: { agentId: input.agentId, kind: input.kind, visitorName: name === "" ? null : name },
        }
    },
}

/** Bounds a message before anything reads it: a known conversation and a text of 1 to 4000 characters. */
export const sendMessageSchema = {
    safeParse: (input: unknown): AgentChatParse<SendMessageInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        if (!isUuid(input.conversationId)) return { success: false, field: "conversation" }
        const body = typeof input.body === "string" ? input.body.trim() : ""
        if (body === "" || body.length > BODY_MAX) return { success: false, field: "body" }
        return { success: true, data: { conversationId: input.conversationId, body } }
    },
}

/** Bounds a take-over request before anything reads it. */
export const takeOverSchema = {
    safeParse: (input: unknown): AgentChatParse<TakeOverInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        if (!isUuid(input.conversationId)) return { success: false, field: "conversation" }
        if (typeof input.take !== "boolean") return { success: false, field: "input" }
        const line = typeof input.line === "string" ? input.line.slice(0, LINE_MAX) : ""
        return { success: true, data: { conversationId: input.conversationId, take: input.take, line } }
    },
}
