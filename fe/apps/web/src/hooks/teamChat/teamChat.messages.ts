import {
    agentCardOf,
    chatMarkOf,
    daysAgoOf,
    groupPositionsOf,
    stopCardViewOf,
    withPendingTaps,
    type GroupPosition,
} from "@/modules/teamChat"
import type {
    ChatParty,
    TeamChatApprovalStatus,
    TeamChatApprovalView,
    TeamChatMessageRow,
    TeamChatReactionView,
} from "@/modules/types"
import { partyOf, type ChatMessageNode, type ChatRowWords } from "./teamChat.shared"

/** The status of a decision from the door's enum; anything unknown reads as pending (the decide door judges it again). */
const approvalStatusOf = (status: string): TeamChatApprovalStatus => {
    if (status === "approved" || status === "refused" || status === "expired") return status
    return "pending"
}

/** The approval card of a message, or null when it carries none. */
const approvalOf = (message: ChatMessageNode, words: ChatRowWords): TeamChatApprovalView | null => {
    const approval = message.approval
    if (approval === null) return null
    return {
        decisionId: approval.decisionId,
        status: approvalStatusOf(approval.status),
        decidedBy: approval.decidedByName ?? "",
        decidedAt: approval.decidedAt === null ? "" : words.timeOf(approval.decidedAt),
        canDecide: approval.canDecide,
    }
}

/** The day label of a message: "Today", "Yesterday", or the date with its year. */
const dayLabelOf = (iso: string, words: ChatRowWords): string => {
    const days = daysAgoOf(iso, words.now)
    if (days <= 0) return words.today
    return days === 1 ? words.yesterday : words.dateWithYearOf(iso)
}

/** The kind of a message from the door's enum; anything unknown reads as text. */
const messageKindOf = (kind: string): TeamChatMessageRow["kind"] => {
    if (kind === "report" || kind === "approval" || kind === "system") return kind
    return "text"
}

/** The author of a message as a party; null for a system line. */
const authorOf = (message: ChatMessageNode, words: ChatRowWords): ChatParty | null =>
    message.authorId === null || message.authorKind === "system"
        ? null
        : partyOf(message.authorKind, message.authorId, message.authorName, words)

/** The structured message an agent line carries: the JSON it was stored as, or null for any other line or text that is not an object. */
const agentMessageOf = (message: ChatMessageNode): Readonly<Record<string, unknown>> | null => {
    if (message.agentMessage === null) return null
    try {
        const parsed: unknown = JSON.parse(message.agentMessage)
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
            ? Object.fromEntries(Object.entries(parsed))
            : null
    } catch {
        return null
    }
}

/** Where the work of an agent opens: one run of it when a run is named, else its work tab; null when the agent is gone. */
type WorkHref = (agentId: string, runId: string | null) => string | null

/** Where the work behind a message opens: the run of a report, the work tab of the agent that asks for an approval. */
const workHrefOf = (message: ChatMessageNode, workHref: WorkHref): string | null => {
    if (message.report !== null) return workHref(message.report.agentId, message.report.runId)
    return message.kind === "approval" && message.authorKind === "agent" && message.authorId !== null
        ? workHref(message.authorId, null)
        : null
}

/** The taps the viewer made that the door has not confirmed yet, by emoji and message. */
type Pending = ReadonlyMap<string, number>

/** The emoji on a message as the thread draws them: what the door read, with the viewer's unconfirmed taps laid over it. */
const reactionsOf = (message: ChatMessageNode, pending: Pending): ReadonlyArray<TeamChatReactionView> =>
    withPendingTaps(
        message.id,
        message.reactions.map((reaction) => ({
            emoji: reaction.emoji,
            count: reaction.count,
            mine: reaction.mineCount,
        })),
        pending,
    )

/** Whether the message opens its day: no message above it, or one of another day. */
const startsDayOf = (message: ChatMessageNode, before: ChatMessageNode | undefined, words: ChatRowWords): boolean =>
    before === undefined || dayLabelOf(before.createdAt, words) !== dayLabelOf(message.createdAt, words)

/** What joins a message to a run of bubbles: its sender, when it holds text or a card of an agent (a system line never joins one). */
const groupItemOf = (message: ChatMessageNode, before: ChatMessageNode | undefined, words: ChatRowWords) => ({
    sender:
        message.kind === "text" && message.authorId !== null
            ? `${message.authorKind}:${message.authorId}`
            : null,
    at: new Date(message.createdAt).getTime(),
    startsDay: startsDayOf(message, before, words),
})

/** What a row is given besides its message: the unconfirmed taps and its place in a run. */
interface RowExtra {
    readonly pending: Pending
    readonly groupPosition: GroupPosition
}

/** One message as a thread row; `before` is the message just above it, for the day divider. */
const messageRowOf = (
    message: ChatMessageNode,
    before: ChatMessageNode | undefined,
    viewerId: string,
    words: ChatRowWords,
    workHref: WorkHref,
    extra: RowExtra,
): TeamChatMessageRow => {
    const day = dayLabelOf(message.createdAt, words)
    const row: Omit<TeamChatMessageRow, "card"> = {
        id: message.id,
        kind: messageKindOf(message.kind),
        side: message.authorKind === "user" && message.authorId === viewerId ? "outgoing" : "incoming",
        author: authorOf(message, words),
        authorName: message.authorName,
        body: message.body,
        timeLabel: words.timeOf(message.createdAt),
        dayLabel: before !== undefined && dayLabelOf(before.createdAt, words) === day ? null : day,
        pinned: message.pinned,
        files: message.attachments.map((file) => ({
            id: file.fileKey,
            name: file.name,
            contentType: file.mimeType,
            url: file.url,
        })),
        workHref: workHrefOf(message, workHref),
        approval: approvalOf(message, words),
        reactions: reactionsOf(message, extra.pending),
        replyTo: message.replyTo,
        forwardedFrom: message.forwardedFrom,
        groupPosition: extra.groupPosition,
    }
    const carded: TeamChatMessageRow = {
        ...row,
        card: agentCardOf({ ...row, agentMessage: agentMessageOf(message) }, words.copy, words.hrefOf),
    }
    return message.stop === null ? carded : { ...carded, stop: stopCardViewOf(message.stop, words.stop, chatMarkOf(carded)) }
}

/**
 * The thread rows in the order they read: the door answers newest first, so the pages are reversed here; a row opens its day when the
 * row before it is of another day.
 */
export const messageRowsOf = (
    nodes: ReadonlyArray<ChatMessageNode>,
    viewerId: string,
    words: ChatRowWords,
    workHref: WorkHref,
    pending: Pending,
): ReadonlyArray<TeamChatMessageRow> => {
    const chronological = [...nodes].reverse()
    const positions = groupPositionsOf(
        chronological.map((message, index) => groupItemOf(message, chronological[index - 1], words)),
    )
    return chronological.map((message, index) =>
        messageRowOf(message, chronological[index - 1], viewerId, words, workHref, {
            pending,
            groupPosition: positions[index] ?? "single",
        }),
    )
}
