import type { useQueryChatMessagesSwr, useQueryChatRoomsSwr } from "@/hooks/swr"
import { daysAgoOf } from "@/modules/teamChat"
import type {
    ChatParty,
    ChatPartyKind,
    TeamChatApprovalStatus,
    TeamChatApprovalView,
    TeamChatMessageRow,
    TeamChatRoomRow,
} from "@/modules/types"

/** One room as the door answers it. */
export type ChatRoomNode = NonNullable<ReturnType<typeof useQueryChatRoomsSwr>["data"]>[number]

/** One message as the door answers it. */
export type ChatMessageNode = NonNullable<ReturnType<typeof useQueryChatMessagesSwr>["data"]>[number]["nodes"][number]

/** The words and clocks a row needs, bound to the viewer's language by the hook. */
export interface ChatRowWords {
    readonly now: Date
    readonly timeOf: (iso: string) => string
    readonly dateOf: (iso: string) => string
    readonly dateWithYearOf: (iso: string) => string
    readonly today: string
    readonly yesterday: string
    readonly noMessage: string
    readonly attachment: string
}

/** The kind of a party from the door's enum. */
const partyKindOf = (kind: string): ChatPartyKind => (kind === "agent" ? "agent" : "user")

/** The party a member or an author is. */
export const partyOf = (kind: string, id: string, name: string): ChatParty => ({ kind: partyKindOf(kind), id, name })

/** The members of a room as parties, the viewer left out: who the composer may mention. */
export const partiesOf = (room: ChatRoomNode | undefined, viewerId: string): ReadonlyArray<ChatParty> =>
    (room?.members ?? [])
        .filter((member) => !(member.memberKind === "user" && member.memberId === viewerId))
        .map((member) => partyOf(member.memberKind, member.memberId, member.name))

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

/** The time of the last message of a room in the short form: the clock today, "yesterday", else the date. */
const whenOf = (iso: string, words: ChatRowWords): string => {
    const days = daysAgoOf(iso, words.now)
    if (days <= 0) return words.timeOf(iso)
    return days === 1 ? words.yesterday : words.dateOf(iso)
}

/** One line of the last message: the author and the first words of it (a file-only message says it carries a file). */
const previewOf = (room: ChatRoomNode, words: ChatRowWords): string => {
    const last = room.lastMessage
    if (last === null) return words.noMessage
    const text = last.body.trim() === "" ? words.attachment : last.body.replaceAll(/\s+/gu, " ").trim()
    return last.authorKind === "system" ? text : `${last.authorName}: ${text}`
}

/** The other party of a direct room: the member that is not the viewer; none for a group. */
export const otherPartyOf = (room: ChatRoomNode, viewerId: string): ChatParty | null => {
    if (room.kind !== "direct") return null
    const member = room.members.find((entry) => !(entry.memberKind === "user" && entry.memberId === viewerId))
    return member === undefined ? null : partyOf(member.memberKind, member.memberId, member.name)
}

/** The room rows of the list, the open one marked. */
export const roomRowsOf = (
    rooms: ReadonlyArray<ChatRoomNode>,
    selectedId: string | null,
    viewerId: string,
    words: ChatRowWords,
): ReadonlyArray<TeamChatRoomRow> =>
    rooms.map((room) => ({
        id: room.id,
        kind: room.kind === "direct" ? "direct" : "group",
        title: room.name,
        other: otherPartyOf(room, viewerId),
        preview: previewOf(room, words),
        when: room.lastMessage === null ? "" : whenOf(room.lastMessage.createdAt, words),
        unread: room.unreadCount,
        mentions: room.mentionCount,
        isSelected: room.id === selectedId,
    }))

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
const authorOf = (message: ChatMessageNode): ChatParty | null =>
    message.authorId === null || message.authorKind === "system"
        ? null
        : partyOf(message.authorKind, message.authorId, message.authorName)

/** Where the run of a report opens, or null when the message is no report. */
type ReportHref = (agentId: string, runId: string) => string | null

/** One message as a thread row; `before` is the message just above it, for the day divider. */
const messageRowOf = (
    message: ChatMessageNode,
    before: ChatMessageNode | undefined,
    viewerId: string,
    words: ChatRowWords,
    reportHref: ReportHref,
): TeamChatMessageRow => {
    const day = dayLabelOf(message.createdAt, words)
    return {
        id: message.id,
        kind: messageKindOf(message.kind),
        side: message.authorKind === "user" && message.authorId === viewerId ? "outgoing" : "incoming",
        author: authorOf(message),
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
        reportHref: message.report === null ? null : reportHref(message.report.agentId, message.report.runId),
        approval: approvalOf(message, words),
    }
}

/**
 * The thread rows in the order they read: the door answers newest first, so the pages are reversed here; a row opens its day when the
 * row before it is of another day.
 */
export const messageRowsOf = (
    nodes: ReadonlyArray<ChatMessageNode>,
    viewerId: string,
    words: ChatRowWords,
    reportHref: ReportHref,
): ReadonlyArray<TeamChatMessageRow> => {
    const chronological = [...nodes].reverse()
    return chronological.map((message, index) =>
        messageRowOf(message, chronological[index - 1], viewerId, words, reportHref),
    )
}
