import { isRecord } from "@modules/platform/primitives"
import { textOf } from "./gateway-frame.mapper"
import type { HistoryTurn, HistoryToolCall } from "./openclaw.contracts"

/**
 * The gateway request that lists the messages of a thread: `chat.history` (scope operator.read) with `{ sessionKey, limit }`, `limit`
 * at most 1000, answering the newest `limit` messages oldest first as `{ messages: [...] }` (starci183/openclaw 0a956010,
 * src/gateway/methods/core-descriptors.ts and packages/gateway-protocol/src/schema/logs-chat.ts).
 */
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

/**
 * The 0-based thread position of the first message of the page. The gateway answers the newest messages of a long thread and numbers
 * every message in `__openclaw.seq` (1-based, from the start), so a page that starts at sequence 41 starts at position 40 and a turn
 * keeps its index when the page window slides; a page whose first message has no sequence starts at 0.
 */
const baseOf = (messages: ReadonlyArray<unknown>): number => {
    const first = messages[0]
    const meta = isRecord(first) && isRecord(first.__openclaw) ? first.__openclaw : null
    const seq = meta === null ? null : meta.seq
    return typeof seq === "number" && Number.isSafeInteger(seq) && seq > 0 ? seq - 1 : 0
}

/** The instant of a message: epoch milliseconds or an ISO text; the fallback when it carries neither. */
const instantOf = (value: unknown, fallback: Date): string => {
    const parsed = typeof value === "number" || typeof value === "string" ? new Date(value) : fallback
    return (Number.isNaN(parsed.getTime()) ? fallback : parsed).toISOString()
}

/**
 * The turns of a `chat.history` answer, `{ messages: [...] }` oldest first. A turn's index is its position in the thread (see
 * `baseOf`), so a message with a role the record does not keep leaves a gap and the others keep their index.
 */
export const historyOf = (payload: unknown, fallback: Date): ReadonlyArray<HistoryTurn> => {
    const messages: ReadonlyArray<unknown> =
        isRecord(payload) && Array.isArray(payload.messages) ? payload.messages : []
    const base = baseOf(messages)
    return messages.flatMap((message: unknown, position): ReadonlyArray<HistoryTurn> => {
        if (!isRecord(message) || typeof message.role !== "string") return []
        const role = ROLES[message.role]
        if (role === undefined) return []
        return [
            {
                index: base + position,
                role,
                text: textOf(message.content ?? message) ?? "",
                toolCalls: toolCallsOf(message.content),
                at: instantOf(message.timestamp, fallback),
            },
        ]
    })
}
