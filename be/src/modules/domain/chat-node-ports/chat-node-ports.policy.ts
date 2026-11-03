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
