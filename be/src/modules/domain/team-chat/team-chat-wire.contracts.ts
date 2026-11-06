import type {
    ApprovalState,
    ChatUpload,
    ChatMemberRef,
    MessageView,
    RoomMemberView,
    RoomUnread,
    ChatRoomView,
} from "./team-chat.contracts"

/** A room that may be absent. */
export type OptionalRoomView = ChatRoomView | null

/** A decision as the wire shows it. */
export interface ApprovalWire extends Omit<ApprovalState, "decidedAt"> {
    /** When it was settled, as ISO text; null while it is pending. */
    readonly decidedAt: string | null
}

/** The run and the agent a report message is about. */
export interface ReportWire {
    /** The run. */
    readonly runId: string
    /** The agent that wrote the report. */
    readonly agentId: string
}

/** A message as the wire shows it. */
export interface MessageWire extends Omit<MessageView, "createdAt" | "editedAt" | "runId" | "decisionId" | "approval"> {
    /** When it was written, as ISO text. */
    readonly createdAt: string
    /** When it was last edited, as ISO text; null when it never was. */
    readonly editedAt: string | null
    /** The run a report is about; null for any other kind. */
    readonly report: ReportWire | null
    /** The state of the decision an approval card is about; null for any other kind. */
    readonly approval: ApprovalWire | null
}

/** A member of a room as the wire shows it. */
export interface RoomMemberWire extends Omit<RoomMemberView, "lastReadAt"> {
    /** Where the member last read, as ISO text. */
    readonly lastReadAt: string
}

/** A room as the wire shows it. */
export interface RoomWire extends Omit<ChatRoomView, "createdAt" | "members" | "lastMessage"> {
    /** When the room was opened, as ISO text. */
    readonly createdAt: string
    /** The members of the room. */
    readonly members: ReadonlyArray<RoomMemberWire>
    /** The newest message; null for an empty room. */
    readonly lastMessage: MessageWire | null
}

/** A room that may be absent, as the wire shows it. */
export type OptionalRoomWire = RoomWire | null

/** The paging facts of a page of a thread. */
export interface PageInfoWire {
    /** Whether older messages follow. */
    readonly hasNextPage: boolean
    /** The cursor of the next page; null on the last one. */
    readonly endCursor: string | null
}

/** A page of a thread as the wire shows it. */
export interface MessagePageWire {
    /** The messages, newest first. */
    readonly nodes: ReadonlyArray<MessageWire>
    /** The paging facts. */
    readonly pageInfo: PageInfoWire
}

/** An upload address as the wire shows it. */
export interface UploadWire extends Omit<ChatUpload, "expiresAt"> {
    /** When the address stops working, as ISO text. */
    readonly expiresAt: string
}

/** The payload of a room mutation. */
export interface RoomPayloadWire {
    /** The room after the change; null when refused or when the room is gone. */
    readonly room: RoomWire | null
    /** Why it was refused; null when it was done. */
    readonly refusal: string | null
}

/** The payload of a message mutation. */
export interface MessagePayloadWire {
    /** The message; null when refused. */
    readonly message: MessageWire | null
    /** Why it was refused; null when it was done. */
    readonly refusal: string | null
}

/** The payload of a verdict on a decision. */
export interface DecisionPayloadWire {
    /** The state every card of the decision now shows; null when refused. */
    readonly approval: ApprovalWire | null
    /** Why it was refused; null when it was done. */
    readonly refusal: string | null
}

/** The payload of an upload request. */
export interface UploadPayloadWire {
    /** The upload address; null when refused. */
    readonly upload: UploadWire | null
    /** Why it was refused; null when it was done. */
    readonly refusal: string | null
}

/** The payload of a read mutation. */
export interface ReadPayloadWire {
    /** What the room has unread after the move; null when refused. */
    readonly unread: RoomUnread | null
    /** Why it was refused; null when it was done. */
    readonly refusal: string | null
}

/** A member reference as an input carries it. */
export interface MemberRefWireInput {
    /** `user` or `agent`; anything else reads as a user. */
    readonly memberKind: string
    /** The account id or the agent id. */
    readonly memberId: string
}

/** The filter of a room list as an input carries it. */
export interface RoomsWireInput {
    /** Only this kind; anything but `direct` or `group` lists both. */
    readonly kind: string | null
    /** Only the rooms the viewer shares with this member, by id. */
    readonly member: string | null
}

/** The page of a thread as an input asks it. */
export interface MessagesWireInput {
    /** The room. */
    readonly roomId: string
    /** The page size. */
    readonly first: number | null
    /** The cursor of the page before. */
    readonly after: string | null
    /** Only the pinned messages when true. */
    readonly pinnedOnly: boolean | null
}

/** A new room as an input carries it. */
export interface CreateRoomWireInput {
    /** `direct`, or anything else for a group. */
    readonly kind: string
    /** The name of a group. */
    readonly name: string | null
    /** The other members. */
    readonly members: ReadonlyArray<MemberRefWireInput>
}

/** A member of a room as an input names it. */
export interface RoomMemberWireInput {
    /** The room. */
    readonly roomId: string
    /** The member. */
    readonly member: MemberRefWireInput
}

/** A message to send as an input carries it. */
export interface SendWireInput {
    /** The room; null for the first message to a member. */
    readonly roomId: string | null
    /** The member a first message goes to. */
    readonly to: MemberRefWireInput | null
    /** The text. */
    readonly body: string
    /** The members it mentions; null for none. */
    readonly mentions: ReadonlyArray<MemberRefWireInput> | null
    /** The files it carries; null for none. */
    readonly fileKeys: ReadonlyArray<string> | null
    /** The retry key. */
    readonly clientId: string | null
}

/** A verdict as an input carries it. */
export interface DecideWireInput {
    /** The decision. */
    readonly decisionId: string
    /** `reject`, or anything else for an approval. */
    readonly verdict: string
}

/** The request of a room list. */
export interface RoomsWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** Only this kind; null lists both. */
    readonly kind: "direct" | "group" | null
    /** Only the rooms the viewer shares with this member, by id. */
    readonly member: string | null
}

/** The request of one page of a thread. */
export interface MessagesWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The room. */
    readonly roomId: string
    /** The page size. */
    readonly first: number | null
    /** The cursor of the page before. */
    readonly after: string | null
    /** Only the pinned messages. */
    readonly pinnedOnly: boolean
}

/** The request of a new room. */
export interface CreateRoomWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** `direct` or `group`. */
    readonly kind: "direct" | "group"
    /** The name of a group. */
    readonly name: string | null
    /** The other members. */
    readonly members: ReadonlyArray<ChatMemberRef>
}

/** The request that adds or removes a member of a room. */
export interface RoomMemberWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The room. */
    readonly roomId: string
    /** The member. */
    readonly member: ChatMemberRef
}

/** The request of a message to send. */
export interface SendWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The room; null for the first message to a member. */
    readonly roomId: string | null
    /** The member a first message goes to. */
    readonly to: ChatMemberRef | null
    /** The text. */
    readonly body: string
    /** The members it mentions. */
    readonly mentions: ReadonlyArray<ChatMemberRef>
    /** The files it carries. */
    readonly fileKeys: ReadonlyArray<string>
    /** The retry key. */
    readonly clientId: string | null
}

/** The request of a verdict on a decision. */
export interface DecideWireRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The decision. */
    readonly decisionId: string
    /** Approve or reject. */
    readonly verdict: "approve" | "reject"
}
