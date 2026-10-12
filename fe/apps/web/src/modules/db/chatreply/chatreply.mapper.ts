/** A reply the member typed while holding a conversation. */
export interface ChatReplyInput {
    readonly conversationId: string
    readonly body: string
}

/** Taking a conversation over (the AI goes quiet) or handing it back. */
export interface ChatHandlingInput {
    readonly conversationId: string
    readonly takeOver: boolean
}

/** The answer to a waiting escalation; null text declines to answer. */
export interface ChatAnswerInput {
    readonly workItemId: string
    readonly conversationId: string
    readonly text: string | null
}

/** Which part of the input a refusal names. */
export type ChatInputField = "input" | "conversation" | "work-item" | "body"

type Parse<Data> =
    { readonly success: true; readonly data: Data } | { readonly success: false; readonly field: ChatInputField }

const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/u
const BODY_MAX = 4000

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const uuidOf = (value: unknown): string | null => (typeof value === "string" && UUID.test(value) ? value : null)

/** Bounds a reply before anything reads it: a known conversation and a text of 1 to 4000 characters. */
export const chatReplySchema = {
    safeParse: (input: unknown): Parse<ChatReplyInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const conversationId = uuidOf(input.conversationId)
        if (conversationId === null) return { success: false, field: "conversation" }
        const body = typeof input.body === "string" ? input.body.trim() : ""
        if (body.length === 0 || body.length > BODY_MAX) return { success: false, field: "body" }
        return { success: true, data: { conversationId, body } }
    },
}

/** Bounds a take over or hand back: a known conversation and a yes or no. */
export const chatHandlingSchema = {
    safeParse: (input: unknown): Parse<ChatHandlingInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const conversationId = uuidOf(input.conversationId)
        if (conversationId === null) return { success: false, field: "conversation" }
        if (typeof input.takeOver !== "boolean") return { success: false, field: "input" }
        return { success: true, data: { conversationId, takeOver: input.takeOver } }
    },
}

/** Bounds an answer to an escalation: a known item and conversation, and a text of 1 to 4000 characters or null to decline. */
export const chatAnswerSchema = {
    safeParse: (input: unknown): Parse<ChatAnswerInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const workItemId = uuidOf(input.workItemId)
        if (workItemId === null) return { success: false, field: "work-item" }
        const conversationId = uuidOf(input.conversationId)
        if (conversationId === null) return { success: false, field: "conversation" }
        if (input.text === null) return { success: true, data: { workItemId, conversationId, text: null } }
        const text = typeof input.text === "string" ? input.text.trim() : ""
        if (text.length === 0 || text.length > BODY_MAX) return { success: false, field: "body" }
        return { success: true, data: { workItemId, conversationId, text } }
    },
}
