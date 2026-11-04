import { createHash } from "node:crypto"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"

/** The most rows one node read answers. */
export const NODE_ROWS_MAX = 50

/** One message to a customer conversation. */
export interface ChannelSend {
    /** The conversation. */
    readonly conversationId: string
    /** The text. */
    readonly text: string
    /** Files shared as links under the text. */
    readonly attachments?: ReadonlyArray<{ readonly url: string; readonly name: string }> | undefined
}

/** How many rows a query asks for, kept between one and the most a read answers. */
export const limitOf = (query: NodeQuery): number => Math.min(Math.max(query.limit ?? NODE_ROWS_MAX, 1), NODE_ROWS_MAX)

/** The row cut to the asked fields. */
export const cutFields = (row: NodeRow, fields: ReadonlyArray<string>): NodeRow =>
    Object.fromEntries(fields.map((field) => [field, row[field]]))

/** Whether a row matches every `where` entry. */
export const matchesWhere = (row: NodeRow, where: NodeQuery["where"]): boolean =>
    Object.entries(where ?? {}).every(([name, value]) => row[name] === value)

/** The status a node sees: a person holds the conversation, or the agent answers. */
export const statusOf = (handledBy: string | null): "with_person" | "agent" =>
    handledBy === null ? "agent" : "with_person"

/** The text with its attachments as links under it, one per line. */
export const textWithLinks = (send: ChannelSend): string =>
    [send.text, ...(send.attachments ?? []).map((file) => `${file.name}: ${file.url}`)].join("\n")

/** The one conversation a `turn` read may reach, or null when the turn serves none: a `where.id` of another conversation reaches nothing. */
export const turnConversationOf = (turn: NodeTurn, wanted: unknown): string | null =>
    turn.conversationId !== null && (wanted === undefined || wanted === turn.conversationId)
        ? turn.conversationId
        : null

export { RECIPIENT_NOT_LINKED, recipientLinked } from "@modules/domain/channels"

/** A Zalo user id is a string of digits; an import writes a placeholder sender in its place. */
const ZALO_USER_ID = /^[0-9]+$/u

/** True when a Zalo conversation names a customer that is no Zalo user (an imported conversation's placeholder sender), so nothing can reach them. */
export const placeholderRecipient = (target: {
    readonly channel: string
    readonly externalId: string | null
}): boolean =>
    target.channel === "zalo" &&
    target.externalId !== null &&
    !ZALO_USER_ID.test(target.externalId.split(":", 1).join(""))

/** The Zalo refusals that say the recipient cannot be reached at all: the user is unknown or invalid, or does not follow the OA. */
const UNREACHABLE_FAILURES: ReadonlySet<string> = new Set(["zalo_recipient", "zalo_unfollowed"])

/** True when the channel refused a message because of who it was for, not because of the window, the quota or its own state. */
export const recipientRefused = (failure: string | null): boolean =>
    failure !== null && UNREACHABLE_FAILURES.has(failure)

/** The id of the stored message of one send: the same on every attempt of the same effect call, so a retry finds the message and never stores a second. */
export const messageIdOf = (key: string): string => {
    const hex = createHash("sha1").update(`channel.send:${key}`).digest("hex")
    const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
}
