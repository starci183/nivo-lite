import type { ChatMessagesQuery, ChatRoomsQuery } from "@/modules/api"
import type {
    ChatParty,
    ChatPartyKind,
    TeamChatApprovalStatus,
    TeamChatApprovalView,
    TeamChatMessageRow,
    TeamChatRoomRow,
} from "@/modules/teamChat"
import { daysAgoOf } from "@/modules/teamChat"

/** One room as the door answers it. */
export type ChatRoomNode = ChatRoomsQuery["chatRooms"][number]

/** One message as the door answers it. */
export type ChatMessageNode = ChatMessagesQuery["chatMessages"]["nodes"][number]

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
    if (approval === null || approval === undefined) return null
    return {
        decisionId: approval.decisionId,
        status: approvalStatusOf(approval.status),
        decidedBy: approval.decidedByName ?? "",
        decidedAt: approval.decidedAt === null || approval.decidedAt === undefined ? "" : words.timeOf(approval.decidedAt),
        canDecide: approval.canDecide,
    }
}

/** The time of the last message of a room in the short form: the clock today, "yesterday", else the date. */
const whenOf = (iso: string, words: ChatRowWords): string => {
    const days = daysAgoOf(iso, words.now)
    if (days <= 0) return words.timeOf(iso)
    if (days === 1) return words.yesterday
    return words.dateOf(iso)
}

/** One line of the last message: the author and the first words of it (a file-only message says it carries a file). */
const previewOf = (room: ChatRoomNode, words: ChatRowWords): string => {
    const last = room.lastMessage
    if (last === null || last === undefined) return words.noMessage
    const text = last.body.trim() === "" ? words.attachment : last.body.replace(/\s+/gu, " ").trim()
    return last.authorKind === "system" ? text : `${last.authorName}: ${text}`
}

/** The room rows of the list, the open one marked. */
export const roomRowsOf = (
    rooms: ReadonlyArray<ChatRoomNode>,
    selectedId: string | null,
    viewerId: string,
    words: ChatRowWords,
): ReadonlyArray<TeamChatRoomRow> =>
    rooms.map((room) => {
        const otherMember =
            room.kind === "direct"
                ? room.members.find((member) => !(member.memberKind === "user" && member.memberId === viewerId))
                : undefined
        return {
            id: room.id,
            kind: room.kind === "direct" ? "direct" : "group",
            title: room.name,
            other:
                otherMember === undefined ? null : partyOf(otherMember.memberKind, otherMember.memberId, otherMember.name),
            preview: previewOf(room, words),
            when: room.lastMessage === null || room.lastMessage === undefined ? "" : whenOf(room.lastMessage.createdAt, words),
            unread: room.unreadCount,
            mentions: room.mentionCount,
            isSelected: room.id === selectedId,
        }
    })

/** The day label of a message: "Today", "Yesterday", or the date with its year. */
const dayLabelOf = (iso: string, words: ChatRowWords): string => {
    const days = daysAgoOf(iso, words.now)
    if (days <= 0) return words.today
    if (days === 1) return words.yesterday
    return words.dateWithYearOf(iso)
}

/** The kind of a message from the door's enum; anything unknown reads as text. */
const messageKindOf = (kind: string): TeamChatMessageRow["kind"] => {
    if (kind === "report" || kind === "approval" || kind === "system") return kind
    return "text"
}

/**
 * The thread rows in the order they read: the door answers newest first, so the page is reversed here; a row opens its day when the
 * row before it is of another day.
 */
export const messageRowsOf = (
    nodes: ReadonlyArray<ChatMessageNode>,
    viewerId: string,
    words: ChatRowWords,
    reportHref: (agentId: string, runId: string) => string | null,
): ReadonlyArray<TeamChatMessageRow> => {
    const chronological = [...nodes].reverse()
    return chronological.map((message, index) => {
        const day = dayLabelOf(message.createdAt, words)
        const before = chronological[index - 1]
        const isOwn = message.authorKind === "user" && message.authorId === viewerId
        return {
            id: message.id,
            kind: messageKindOf(message.kind),
            side: isOwn ? "outgoing" : "incoming",
            author:
                message.authorId === null || message.authorId === undefined || message.authorKind === "system"
                    ? null
                    : partyOf(message.authorKind, message.authorId, message.authorName),
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
            reportHref:
                message.report === null || message.report === undefined
                    ? null
                    : reportHref(message.report.agentId, message.report.runId),
            approval: approvalOf(message, words),
        }
    })
}
