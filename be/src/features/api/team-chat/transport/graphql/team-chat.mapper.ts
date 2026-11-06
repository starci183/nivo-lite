import { TeamChatErrorCode } from "@modules/domain/team-chat"
import type {
    MemberRef,
    MessagePage,
    MessageView,
    ChatUpload,
    RoomUnread,
    RoomView,
    TeamChatResult,
    UnreadView,
} from "@modules/domain/team-chat"
import type { ChatDecisionPayloadType } from "./dto/chat-decision-payload.type"
import type { ChatFileUploadPayloadType } from "./dto/chat-file-upload-payload.type"
import type { DecideOutcome } from "../../application/team-chat.contracts"
import type { ChatMemberRefInput } from "./dto/chat-member-ref.input"
import type { ChatMessagePageType } from "./dto/chat-message-page.type"
import type { ChatMessagePayloadType } from "./dto/chat-message-payload.type"
import type { ChatMessageType } from "./dto/chat-message.type"
import type { ChatReadPayloadType } from "./dto/chat-read-payload.type"
import type { ChatRoomPayloadType } from "./dto/chat-room-payload.type"
import type { ChatRoomUnreadType } from "./dto/chat-room-unread.type"
import type { ChatRoomType } from "./dto/chat-room.type"
import type { ChatUnreadType } from "./dto/chat-unread.type"

/** The `refusal` value of each domain refusal. */
const REFUSALS: Record<TeamChatErrorCode, string> = {
    [TeamChatErrorCode.NotFound]: "not_found",
    [TeamChatErrorCode.NotMember]: "not_member",
    [TeamChatErrorCode.Forbidden]: "forbidden",
    [TeamChatErrorCode.DirectNeedsTwo]: "direct_needs_two",
    [TeamChatErrorCode.GroupNeedsName]: "group_needs_name",
    [TeamChatErrorCode.MemberUnknown]: "member_unknown",
    [TeamChatErrorCode.AlreadyMember]: "already_member",
    [TeamChatErrorCode.NotAMemberToRemove]: "not_a_member_to_remove",
    [TeamChatErrorCode.LastOwner]: "last_owner",
    [TeamChatErrorCode.BodyEmpty]: "body_empty",
    [TeamChatErrorCode.BodyTooLong]: "body_too_long",
    [TeamChatErrorCode.TooManyMentions]: "too_many_mentions",
    [TeamChatErrorCode.TooManyFiles]: "too_many_files",
    [TeamChatErrorCode.FileTooLarge]: "file_too_large",
    [TeamChatErrorCode.FileTypeNotAllowed]: "file_type_not_allowed",
    [TeamChatErrorCode.StorageUnavailable]: "storage_unavailable",
}

/** A member reference of an input as the domain names it. */
export const toMemberRef = (input: ChatMemberRefInput): MemberRef => ({
    memberKind: input.memberKind === "agent" ? "agent" : "user",
    memberId: input.memberId,
})

/** A message of the domain as the contract shows it. */
export const toChatMessageType = (view: MessageView): ChatMessageType => ({
    id: view.id,
    roomId: view.roomId,
    kind: view.kind,
    authorKind: view.authorKind,
    authorId: view.authorId,
    authorName: view.authorName,
    body: view.body,
    createdAt: view.createdAt,
    editedAt: view.editedAt,
    pinned: view.pinned,
    mentions: view.mentions,
    attachments: view.attachments,
    report: view.runId === null || view.authorId === null ? null : { runId: view.runId, agentId: view.authorId },
    approval: view.approval,
})

/** A room of the domain as the contract shows it. */
export const toChatRoomType = (view: RoomView): ChatRoomType => ({
    ...view,
    lastMessage: view.lastMessage === null ? null : toChatMessageType(view.lastMessage),
})

/** A page of a thread as the contract shows it. */
export const toChatMessagePageType = (page: MessagePage): ChatMessagePageType => ({
    nodes: page.nodes.map(toChatMessageType),
    pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
})

/** What the viewer has unread as the contract shows it. */
export const toChatUnreadType = (view: UnreadView): ChatUnreadType => ({
    total: view.total,
    mentionTotal: view.mentionTotal,
    rooms: view.rooms.map((room): ChatRoomUnreadType => ({ ...room })),
})

/** The payload of a room mutation. */
export const toRoomPayload = (result: TeamChatResult<RoomView | null>): ChatRoomPayloadType =>
    result.ok
        ? { room: result.value === null ? null : toChatRoomType(result.value), refusal: null }
        : { room: null, refusal: REFUSALS[result.refusal] }

/** The payload of a message mutation. */
export const toMessagePayload = (result: TeamChatResult<MessageView>): ChatMessagePayloadType =>
    result.ok
        ? { message: toChatMessageType(result.value), refusal: null }
        : { message: null, refusal: REFUSALS[result.refusal] }

/** The payload of a verdict on a decision. */
export const toDecisionPayload = (outcome: DecideOutcome): ChatDecisionPayloadType =>
    outcome.ok ? { approval: outcome.approval, refusal: null } : { approval: null, refusal: outcome.refusal }

/** The payload of an upload request. */
export const toUploadPayload = (result: TeamChatResult<ChatUpload>): ChatFileUploadPayloadType =>
    result.ok ? { upload: { ...result.value }, refusal: null } : { upload: null, refusal: REFUSALS[result.refusal] }

/** The payload of a read mutation. */
export const toReadPayload = (result: TeamChatResult<RoomUnread>): ChatReadPayloadType =>
    result.ok ? { unread: { ...result.value }, refusal: null } : { unread: null, refusal: REFUSALS[result.refusal] }
