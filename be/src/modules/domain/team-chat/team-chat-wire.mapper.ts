import { TeamChatErrorCode } from "./errors/team-chat.error"
import type {
    DecideOutcome,
    ApprovalState,
    ChatUpload,
    ChatMemberRef,
    GroupPurpose,
    MessagePage,
    MessageView,
    RoomUnread,
    ChatRoomView,
    TeamChatResult,
} from "./team-chat.contracts"
import type {
    ApprovalWire,
    CreateRoomWireInput,
    CreateRoomWireRequest,
    DecideWireInput,
    DecideWireRequest,
    DecisionPayloadWire,
    MemberRefWireInput,
    MessagePageWire,
    MessagePayloadWire,
    MessagesWireInput,
    MessagesWireRequest,
    MessageWire,
    OptionalRoomView,
    OptionalModuleKey,
    OptionalRoomWire,
    ReadPayloadWire,
    RoomMemberWireInput,
    RoomMemberWireRequest,
    RoomPayloadWire,
    RoomsWireInput,
    RoomsWireRequest,
    RoomWire,
    SendWireInput,
    SendWireRequest,
    UploadPayloadWire,
} from "./team-chat-wire.contracts"

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
    [TeamChatErrorCode.InvalidAgentMessage]: "invalid_agent_message",
    [TeamChatErrorCode.AgentMessageNotPosted]: "agent_message_not_posted",
    [TeamChatErrorCode.PurposeInvalid]: "purpose_invalid",
    [TeamChatErrorCode.PurposeTaken]: "purpose_taken",
    [TeamChatErrorCode.PostRightNeedsSeat]: "post_right_needs_seat",
    [TeamChatErrorCode.ReactionInvalid]: "reaction_invalid",
    [TeamChatErrorCode.ReactionRateLimited]: "reaction_rate_limited",
}

/** An instant as ISO text, the way this schema carries every instant. */
const isoOf = (at: Date): string => at.toISOString()

/** An instant that may be absent, as ISO text or null. */
const isoOrNull = (at: Date | null): string | null => (at === null ? null : isoOf(at))

/** The state of a decision as the wire shows it. */
const approvalWireOf = (approval: ApprovalState): ApprovalWire => ({
    ...approval,
    decidedAt: isoOrNull(approval.decidedAt),
})

/** A member reference of an input as the domain names it. */
export const memberRefOf = (input: MemberRefWireInput): ChatMemberRef => ({
    memberKind: input.memberKind === "agent" ? "agent" : "user",
    memberId: input.memberId,
})

/** A message of the domain as the wire shows it. */
export const messageWireOf = (view: MessageView): MessageWire => ({
    id: view.id,
    roomId: view.roomId,
    kind: view.kind,
    authorKind: view.authorKind,
    authorId: view.authorId,
    authorName: view.authorName,
    body: view.body,
    createdAt: isoOf(view.createdAt),
    editedAt: isoOrNull(view.editedAt),
    pinned: view.pinned,
    mentions: view.mentions,
    attachments: view.attachments,
    report: view.runId === null || view.authorId === null ? null : { runId: view.runId, agentId: view.authorId },
    approval: view.approval === null ? null : approvalWireOf(view.approval),
    agentMessage: view.agentMessage,
    reactions: view.reactions,
    replyTo: view.replyTo,
    forwardedFrom: view.forwardedFrom,
    stop: view.stop,
    brainChange: view.brainChange,
    backgroundStopped: view.backgroundStopped,
})

/** A room of the domain as the wire shows it. */
export const roomWireOf = (view: ChatRoomView): RoomWire => ({
    ...view,
    createdAt: isoOf(view.createdAt),
    members: view.members.map((member) => ({ ...member, lastReadAt: isoOf(member.lastReadAt) })),
    lastMessage: view.lastMessage === null ? null : messageWireOf(view.lastMessage),
})

/** The rooms of a list as the wire shows them. */
export const roomsWireOf = (views: ReadonlyArray<ChatRoomView>): Array<RoomWire> => views.map((view) => roomWireOf(view))

/** One room that may be absent, as the wire shows it. */
export const roomOrNullWireOf = (view: OptionalRoomView): OptionalRoomWire => (view === null ? null : roomWireOf(view))

/** A page of a thread as the wire shows it. */
export const messagePageWireOf = (page: MessagePage): MessagePageWire => ({
    nodes: page.nodes.map((node) => messageWireOf(node)),
    pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
})

/** The payload of a room mutation. */
export const roomPayloadOf = (result: TeamChatResult<OptionalRoomView>): RoomPayloadWire =>
    result.ok
        ? { room: roomOrNullWireOf(result.value), refusal: null }
        : { room: null, refusal: REFUSALS[result.refusal] }

/** The payload of a message mutation. */
export const messagePayloadOf = (result: TeamChatResult<MessageView>): MessagePayloadWire =>
    result.ok
        ? { message: messageWireOf(result.value), refusal: null }
        : { message: null, refusal: REFUSALS[result.refusal] }

/** The payload of a verdict on a decision. */
export const decisionPayloadOf = (outcome: DecideOutcome): DecisionPayloadWire =>
    outcome.ok
        ? { approval: approvalWireOf(outcome.approval), refusal: null }
        : { approval: null, refusal: outcome.refusal }

/** The payload of an upload request. */
export const uploadPayloadOf = (result: TeamChatResult<ChatUpload>): UploadPayloadWire =>
    result.ok
        ? { upload: { ...result.value, expiresAt: isoOf(result.value.expiresAt) }, refusal: null }
        : { upload: null, refusal: REFUSALS[result.refusal] }

/** The payload of a read mutation. */
export const readPayloadOf = (result: TeamChatResult<RoomUnread>): ReadPayloadWire =>
    result.ok ? { unread: result.value, refusal: null } : { unread: null, refusal: REFUSALS[result.refusal] }

/** The kind a room list narrows to; null lists both. */
const roomKindOf = (kind: string | null | undefined): "direct" | "group" | null =>
    kind === "direct" || kind === "group" ? kind : null

/** The request of a room list; no input lists every room. */
export const roomsRequestOf = (workspaceId: string, input?: RoomsWireInput): RoomsWireRequest => ({
    workspaceId,
    kind: roomKindOf(input?.kind),
    member: input?.member ?? null,
})

/** The request of one page of a thread. */
export const messagesRequestOf = (workspaceId: string, input: MessagesWireInput): MessagesWireRequest => ({
    workspaceId,
    roomId: input.roomId,
    first: input.first,
    after: input.after,
    pinnedOnly: input.pinnedOnly === true,
})

/** The purpose of a group as an input names it; a module room without a module stays invalid for the domain to refuse. */
export const purposeOf = (purpose: string, module: OptionalModuleKey): GroupPurpose =>
    purpose === "module"
        ? { purpose: "module", module: module ?? "" }
        : { purpose: purpose === "common" ? "common" : "group" }

/** The request of a new room. */
export const createRoomRequestOf = (workspaceId: string, input: CreateRoomWireInput): CreateRoomWireRequest => ({
    workspaceId,
    kind: input.kind === "direct" ? "direct" : "group",
    name: input.name,
    members: input.members.map((member) => memberRefOf(member)),
    ...(input.purpose == null ? {} : { purpose: purposeOf(input.purpose, input.purposeModule ?? null) }),
})

/** The request that adds or removes a member of a room. */
export const roomMemberRequestOf = (workspaceId: string, input: RoomMemberWireInput): RoomMemberWireRequest => ({
    workspaceId,
    roomId: input.roomId,
    member: memberRefOf(input.member),
})

/** The request of a message to send. */
export const sendRequestOf = (workspaceId: string, input: SendWireInput): SendWireRequest => ({
    workspaceId,
    roomId: input.roomId,
    to: input.to === null ? null : memberRefOf(input.to),
    body: input.body,
    mentions: (input.mentions ?? []).map((mention) => memberRefOf(mention)),
    fileKeys: input.fileKeys ?? [],
    clientId: input.clientId,
    replyTo: input.replyTo ?? null,
})

/** The request of a verdict on a decision. */
export const decideRequestOf = (workspaceId: string, input: DecideWireInput): DecideWireRequest => ({
    workspaceId,
    decisionId: input.decisionId,
    verdict: input.verdict === "reject" ? "reject" : "approve",
})
