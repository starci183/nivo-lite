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

/** The decisions the approval cards among the messages are about. */
export const decisionIdsOf = (messages: ReadonlyArray<ChatRoomMessageEntity>): Array<string> =>
    messages.flatMap((message) => {
        const decisionId = message.ref?.decision_id
        return message.kind === "approval" && decisionId !== undefined ? [decisionId] : []
    })

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
