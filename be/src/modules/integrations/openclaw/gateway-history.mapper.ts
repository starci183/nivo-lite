import { isRecord } from "@modules/platform/primitives"
import { textOf } from "./gateway-frame.mapper"
import type { HistoryTurn, HistoryToolCall } from "./openclaw.contracts"

/** The gateway request that lists the messages of a thread, oldest first. */
export const HISTORY_METHOD = "chat.history"

/** The most messages one history read asks for. */
export const HISTORY_LIMIT = 1000

const ROLES: Readonly<Record<string, HistoryTurn["role"]>> = {
    user: "user",
    assistant: "assistant",
    system: "system",
    tool: "tool",
    toolResult: "tool",
}

const TOOL_CALL_TYPES: ReadonlySet<string> = new Set(["toolCall", "tool_use", "toolUse"])

/** The longest name and arguments text one recorded tool call keeps, and the most calls a turn keeps. */
const NAME_MAX = 200
const ARGS_MAX = 20_000
const CALLS_MAX = 50

/** The tool calls in the content of an assistant message. */
const toolCallsOf = (content: unknown): ReadonlyArray<HistoryToolCall> => {
    if (!Array.isArray(content)) return []
    return content
        .flatMap((part: unknown): ReadonlyArray<HistoryToolCall> => {
            if (!isRecord(part) || typeof part.name !== "string" || !TOOL_CALL_TYPES.has(String(part.type))) return []
            const args = JSON.stringify(part.arguments ?? part.input ?? {})
            return [{ name: part.name.slice(0, NAME_MAX), argsJson: args.slice(0, ARGS_MAX) }]
        })
        .slice(0, CALLS_MAX)
}

/** The instant of a message: epoch milliseconds or an ISO text; the fallback when it carries neither. */
const instantOf = (value: unknown, fallback: Date): string => {
    const parsed = typeof value === "number" || typeof value === "string" ? new Date(value) : fallback
    return (Number.isNaN(parsed.getTime()) ? fallback : parsed).toISOString()
}

/**
 * The turns of a `chat.history` answer, `{ messages: [...] }` oldest first. A turn's index is its position in the thread, so a
 * message with a role the record does not keep leaves a gap and the others keep their index.
 */
export const historyOf = (payload: unknown, fallback: Date): ReadonlyArray<HistoryTurn> => {
    const messages: ReadonlyArray<unknown> =
        isRecord(payload) && Array.isArray(payload.messages) ? payload.messages : []
    return messages.flatMap((message: unknown, index): ReadonlyArray<HistoryTurn> => {
        if (!isRecord(message) || typeof message.role !== "string") return []
        const role = ROLES[message.role]
        if (role === undefined) return []
        return [
            {
                index,
                role,
                text: textOf(message.content ?? message) ?? "",
                toolCalls: toolCallsOf(message.content),
                at: instantOf(message.timestamp, fallback),
            },
        ]
    })
}
