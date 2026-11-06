import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type {
    ChatCustomerLine,
    MessageData,
    ChatStoredMessage,
    ChatStoredReply,
    ChatTranscriptLine,
} from "./chat-records.contracts"
import { messageDataSchema } from "./chat-records.schema"

/** The most lines of a transcript. */
export const TRANSCRIPT_MAX = 40

/** The fields a query for line rows selects. */
export const MESSAGE_SELECT: ReadonlyArray<string> = [
    "conversationId",
    "role",
    "text",
    "sentAt",
    "deliveryStatus",
    "deliveryError",
    "channelRef",
]

/** A line row with its fields read; null when the record holds fields that are not a line's. */
export interface LineFacts {
    /** The record id. */
    readonly id: string
    /** The record version. */
    readonly version: string
    /** The line's fields. */
    readonly data: MessageData
}

/** The line a record holds, or null. */
export const lineOf = (record: RecordRow): LineFacts | null => {
    const parsed = messageDataSchema.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, data: parsed.data } : null
}

/** The stored message of a line. */
export const storedMessageOf = (line: LineFacts): ChatStoredMessage => ({
    id: line.id,
    role: line.data.role,
    body: line.data.text,
    deliveryStatus: line.data.deliveryStatus,
})

/** What the customer said, with the time. */
export const customerLineOf = (line: LineFacts): ChatCustomerLine => ({
    id: line.id,
    body: line.data.text,
    at: new Date(line.data.sentAt),
})

/** The transcript of newest-first lines: oldest first, system lines left out. */
export const transcriptOf = (newestFirst: ReadonlyArray<LineFacts>): ReadonlyArray<ChatTranscriptLine> =>
    newestFirst
        .filter((line) => line.data.role !== "system")
        .map((line): ChatTranscriptLine => ({
            role: line.data.role === "user" ? "user" : "agent",
            body: line.data.text,
        }))
        .reverse()

/** The line a record holds as a one-element list, or none: for a flat map over rows that may hold other fields. */
export const linesOf = (record: RecordRow): ReadonlyArray<LineFacts> => {
    const line = lineOf(record)
    return line === null ? [] : [line]
}

/** The reply a stored line stands for: its text, and whether it reached the customer. */
export const replyOf = (line: LineFacts): ChatStoredReply => ({
    id: line.id,
    body: line.data.text,
    sent: line.data.deliveryStatus === "sent",
})
