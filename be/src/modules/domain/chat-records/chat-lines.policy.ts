import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { LineFile, LineOrder } from "@nivo-lite/blocks-core/rules/chatbot"
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

/**
 * The key a run's honest holding line is stored under starts with this (`honest-line:<runId>`): the line promises a reply, it is not one,
 * so what the customer said before it is still unanswered.
 */
export const HOLDING_LINE_KEY_PREFIX = "honest-line:"

/** The channel ref a stored line keeps for its key. */
export const lineRefOf = (key: string): string => `line:${key}`

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

/** The `files` field a line is stored with: the pictures in an object (a jsonb field is an object); none is null. */
export const filesFieldOf = (files: ReadonlyArray<LineFile> | undefined): JsonValue =>
    files === undefined || files.length === 0
        ? null
        : {
              items: files.map((file) => ({
                  id: file.id,
                  url: file.url,
                  name: file.name,
                  contentType: file.contentType,
              })),
          }

/** The `orderCard` field a line is stored with: the order snapshot, or null when the line is about none. */
export const orderFieldOf = (order: LineOrder | undefined): JsonValue =>
    order === undefined
        ? null
        : {
              orderNo: order.orderNo,
              lines: order.lines.map((line) => ({
                  name: line.name,
                  qty: line.qty,
                  ...(line.unitText === undefined ? {} : { unitText: line.unitText }),
                  ...(line.amountText === undefined ? {} : { amountText: line.amountText }),
                  ...(line.imageUrl === undefined ? {} : { imageUrl: line.imageUrl }),
              })),
              amountText: order.amountText,
              address: order.address,
              paid: order.paid,
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

/** Whether an agent line answered the customer: any agent line but a run's honest holding line. */
export const answersCustomer = (line: LineFacts): boolean =>
    !(line.data.channelRef ?? "").startsWith(lineRefOf(HOLDING_LINE_KEY_PREFIX))
