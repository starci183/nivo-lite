import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { NodeRow } from "@modules/domain/graph-nodes"

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

/** A reply the AI drafted for a person to approve. */
export interface ProposeReply {
    /** The conversation. */
    readonly conversationId: string
    /** The words of the draft. */
    readonly text: string
    /** What the customer asked, so the owner sees what the draft answers. */
    readonly asked: string
}

/** How many rows a query asks for, kept between one and the most a read answers. */
export const limitOf = (query: NodeQuery): number => Math.min(Math.max(query.limit ?? NODE_ROWS_MAX, 1), NODE_ROWS_MAX)

/** The row cut to the asked fields. */
export const cutFields = (row: NodeRow, fields: ReadonlyArray<string>): NodeRow =>
    Object.fromEntries(fields.map((field) => [field, row[field]]))

/** Whether a row matches every `where` entry. */
export const matchesWhere = (row: NodeRow, where: NodeQuery["where"]): boolean =>
    Object.entries(where ?? {}).every(([name, value]) => row[name] === value)

/** The text with its attachments as links under it, one per line. */
export const textWithLinks = (send: ChannelSend): string =>
    [send.text, ...(send.attachments ?? []).map((file) => `${file.name}: ${file.url}`)].join("\n")

export { RECIPIENT_NOT_LINKED, recipientLinked } from "@modules/domain/channels"

/** A Zalo user id is a string of digits; an import writes a placeholder sender in its place. */
const ZALO_USER_ID = /^\d+$/u

/** The customer a conversation reaches: the channel and the id the channel knows them by. */
export interface RecipientTarget {
    /** The channel of the conversation. */
    readonly channel: string
    /** The customer's id on that channel, or null when it holds none. */
    readonly externalId: string | null
}

/** True when a Zalo conversation names a customer that is no Zalo user (an imported conversation's placeholder sender), so nothing can reach them. */
export const placeholderRecipient = (target: RecipientTarget): boolean =>
    target.channel === "zalo" &&
    target.externalId !== null &&
    !ZALO_USER_ID.test(target.externalId.split(":", 1).join(""))

/** The Zalo refusals that say the recipient cannot be reached at all: the user is unknown or invalid, or does not follow the OA. */
const UNREACHABLE_FAILURES: ReadonlySet<string> = new Set(["zalo_recipient", "zalo_unfollowed"])

/** True when the channel refused a message because of who it was for, not because of the window, the quota or its own state. */
export const recipientRefused = (failure: string | null): boolean =>
    failure !== null && UNREACHABLE_FAILURES.has(failure)

/** The Zalo refusals that say the channel is not taking messages right now, so nothing was sent and a later try can go out: the quota of the account and the night hours. */
const BUSY_FAILURES: ReadonlySet<string> = new Set(["zalo_quota", "zalo_night_hours"])

/** True when the channel refused a message for now (its quota, the night hours), not for good: the step is tried again after a backoff. */
export const channelBusy = (failure: string | null): boolean => failure !== null && BUSY_FAILURES.has(failure)

/** Who holds the conversation a record stores: the name of the person, or null when the AI does (or the record says nothing). */
export const handledByOf = (data: Readonly<Record<string, unknown>>): string | null => {
    const held = data["handledBy"]
    return typeof held === "string" ? held : null
}
