import { MEMBERS_MAX } from "./team-chat.contracts"
import type {
    ApprovalState,
    ChatMemberRef,
    MessageView,
    RoomMemberView,
    RoomUnread,
    ChatRoomView,
} from "./team-chat.contracts"
import type { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import { quoteBodyOf } from "./team-chat-reaction.policy"
import type { ReactionView, ReplyView } from "./team-chat-reaction.contracts"
import { stopCardViewOf, stopReplyUsersOf } from "./stop-card.policy"
import { brainChangeCardViewOf, storedBrainChangeOf } from "./brain-change-card.policy"
import type { BrainChangeCost, BrainChangeViewerRole } from "./brain-change-card.contracts"

/** What a thread of messages is read against: the names, the pins, the file addresses and the decisions of its cards. */
export interface MessageViewContext {
    /** The name of each person and agent, by `kind:id`. */
    readonly names: ReadonlyMap<string, string>
    /** The ids of the messages that are pinned. */
    readonly pinned: ReadonlySet<string>
    /** The read address of each stored file, by key. */
    readonly urls: ReadonlyMap<string, string>
    /** Where each decision stands for the viewer, by decision id. */
    readonly approvals: ReadonlyMap<string, ApprovalState>
    /** The reactions of each message, by message id; a message with none has no entry. */
    readonly reactions: ReadonlyMap<string, ReadonlyArray<ReactionView>>
    /** The messages that were quoted, by message id. */
    readonly quoted: ReadonlyMap<string, ChatRoomMessageEntity>
    /** The names of the people who replied to stop cards, by the id the stop keeps (a member seat or an account); none read when absent. */
    readonly stopNames?: ReadonlyMap<string, string>
    /** The viewer's workspace role, read only when the page holds a `brain.change` card (it sets what the card offers); "member" when absent. */
    readonly viewerRole?: BrainChangeViewerRole
    /** What producing each learning card's proposal cost, by change id (U1); read only for an owner or manager. */
    readonly brainChangeCosts?: ReadonlyMap<string, BrainChangeCost>
}

/** What a list of rooms is read against: the viewer, the names, what is unread and the newest message of each room. */
export interface RoomViewContext {
    /** The person who reads the rooms. */
    readonly viewerId: string
    /** The name of each person and agent, by `kind:id`. */
    readonly names: ReadonlyMap<string, string>
    /** The unread counts of the viewer, by room id. */
    readonly unread: ReadonlyMap<string, RoomUnread>
    /** The newest message of each room, by room id. */
    readonly lasts: ReadonlyMap<string, MessageView>
}

/** The key a name is kept under: the kind of the member and its id. */
export const nameKeyOf = (kind: string, id: string): string => `${kind}:${id}`

/** The authors and the mentioned members of the messages, whose names a thread needs. */
export const refsOfMessages = (messages: ReadonlyArray<ChatRoomMessageEntity>): Array<ChatMemberRef> =>
    messages.flatMap<ChatMemberRef>((message) => [
        ...(message.authorId === null || message.authorKind === "system"
            ? []
            : [{ memberKind: message.authorKind, memberId: message.authorId }]),
        ...message.mentions.map((mention) => ({ memberKind: mention.kind, memberId: mention.id })),
    ])

/** Whether a page of messages holds a truth-graph change card (`brain.change`), so the viewer's role is worth reading. */
export const holdsBrainChange = (messages: ReadonlyArray<ChatRoomMessageEntity>): boolean =>
    messages.some((message) => storedBrainChangeOf(message.ref?.agent_message ?? null) !== null)

/** The role a `brain.change` card is read with, from the viewer's workspace role. */
export const brainChangeViewerRoleOf = (role: string | null): BrainChangeViewerRole =>
    role === "owner" || role === "manager" ? role : "member"

/** The ids of the people who replied to the stop cards among the messages (as the stops keep them), whose names a thread needs. */
export const stopReplierIdsOf = (messages: ReadonlyArray<ChatRoomMessageEntity>): Array<string> => [
    ...new Set(messages.flatMap((message) => stopReplyUsersOf(message.ref?.agent_message ?? null))),
]

/** The decisions the approval cards among the messages are about. */
export const decisionIdsOf = (messages: ReadonlyArray<ChatRoomMessageEntity>): Array<string> =>
    messages.flatMap((message) => {
        const decisionId = message.ref?.decision_id
        return message.kind === "approval" && decisionId !== undefined ? [decisionId] : []
    })

/** The quote of the message a reply answers; null when it answers none or the quoted message is gone. */
const replyViewOf = (replyTo: string | null, context: MessageViewContext): ReplyView | null => {
    const quoted = replyTo === null ? undefined : context.quoted.get(replyTo)
    if (quoted === undefined) return null
    return {
        messageId: quoted.id,
        authorName:
            quoted.authorId === null ? "" : (context.names.get(nameKeyOf(quoted.authorKind, quoted.authorId)) ?? ""),
        body: quoteBodyOf(quoted.body),
    }
}

/** The ids of the messages the given messages answer. */
export const repliedIdsOf = (messages: ReadonlyArray<ChatRoomMessageEntity>): Array<string> => [
    ...new Set(messages.flatMap((message) => (typeof message.replyTo === "string" ? [message.replyTo] : []))),
]

/** One message as a screen shows it. */
export const messageViewOf = (message: ChatRoomMessageEntity, context: MessageViewContext): MessageView => {
    const decisionId = message.ref?.decision_id ?? null
    return {
        id: message.id,
        roomId: message.roomId,
        kind: message.kind,
        authorKind: message.authorKind,
        authorId: message.authorId,
        authorName:
            message.authorId === null ? "" : (context.names.get(nameKeyOf(message.authorKind, message.authorId)) ?? ""),
        body: message.body,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        pinned: context.pinned.has(message.id),
        mentions: message.mentions.map((mention) => ({
            memberKind: mention.kind,
            memberId: mention.id,
            name: context.names.get(nameKeyOf(mention.kind, mention.id)) ?? "",
        })),
        attachments: message.attachments.map((file) => ({ ...file, url: context.urls.get(file.fileKey) ?? "" })),
        runId: message.kind === "report" ? (message.ref?.run_id ?? null) : null,
        decisionId: message.kind === "approval" ? decisionId : null,
        approval: decisionId === null ? null : (context.approvals.get(decisionId) ?? null),
        agentMessage: message.ref?.agent_message ?? null,
        reactions: context.reactions.get(message.id) ?? [],
        replyTo: replyViewOf(message.replyTo, context),
        forwardedFrom: message.ref?.forwarded_from ?? null,
        stop: stopCardViewOf(message.ref?.agent_message ?? null, (id) => context.stopNames?.get(id) ?? ""),
        brainChange: brainChangeCardViewOf(
            message.ref?.agent_message ?? null,
            context.viewerRole ?? "member",
            context.brainChangeCosts,
        ),
    }
}

/** The members of a room as a screen lists them: owners first, then by name, at most the bound of a room view. */
export const memberViewsOf = (
    seated: ReadonlyArray<ChatRoomMemberEntity>,
    names: ReadonlyMap<string, string>,
): Array<RoomMemberView> =>
    seated
        .map<RoomMemberView>((member) => ({
            memberKind: member.memberKind,
            memberId: member.memberId,
            name: names.get(nameKeyOf(member.memberKind, member.memberId)) ?? "",
            role: member.role,
            lastReadAt: member.lastReadAt,
            muted: member.muted,
            mayPost: member.memberKind === "agent" && member.mayPost,
        }))
        .toSorted(
            (left, right) =>
                Number(right.role === "owner") - Number(left.role === "owner") || left.name.localeCompare(right.name),
        )
        .slice(0, MEMBERS_MAX)

/** One room as a screen shows it for the viewer: its members, what is unread, the viewer's mute and the newest message. */
export const roomViewOf = (
    room: ChatRoomEntity,
    seated: ReadonlyArray<ChatRoomMemberEntity>,
    context: RoomViewContext,
): ChatRoomView => {
    const members = memberViewsOf(seated, context.names)
    const isViewer = (member: ChatMemberRef): boolean =>
        member.memberKind === "user" && member.memberId === context.viewerId
    const unread = context.unread.get(room.id)
    return {
        id: room.id,
        kind: room.kind,
        purpose: room.purpose,
        purposeModule: room.purposeModule,
        name: room.kind === "group" ? (room.name ?? "") : (members.find((member) => !isViewer(member))?.name ?? ""),
        position: room.position,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        members,
        unreadCount: unread?.unreadCount ?? 0,
        mentionCount: unread?.mentionCount ?? 0,
        muted: seated.find(isViewer)?.muted ?? false,
        lastMessage: context.lasts.get(room.id) ?? null,
    }
}

/** The order of a room list: the room with the newest message first, rooms without one by their position. */
export const compareRooms = (left: ChatRoomView, right: ChatRoomView): number =>
    (right.lastMessage?.createdAt.getTime() ?? 0) - (left.lastMessage?.createdAt.getTime() ?? 0) ||
    left.position - right.position
