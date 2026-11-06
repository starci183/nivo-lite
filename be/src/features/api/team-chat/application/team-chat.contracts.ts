import type { ApprovalState, MemberRef, UploadAsk } from "@modules/domain/team-chat"

/** The workspace selected by X-Workspace-Id; the service proves the caller's seat. */
export interface TeamChatScope {
    /** The selected workspace. */
    readonly workspaceId: string
}

/** The rooms a viewer lists. */
export interface RoomsRequest extends TeamChatScope {
    /** Only the rooms the caller shares with this member (an agent or a person), by id. */
    readonly member: string | null
    /** Only this kind; null lists both. */
    readonly kind: "direct" | "group" | null
}

/** One room by id. */
export interface RoomRequest extends TeamChatScope {
    /** The room. */
    readonly roomId: string
}

/** One page of a thread. */
export interface MessagesRequest extends RoomRequest {
    /** The page size asked. */
    readonly first: number | null
    /** The cursor of the page before. */
    readonly after: string | null
    /** Only the pinned messages. */
    readonly pinnedOnly: boolean
}

/** A new room. */
export interface CreateRoomRequest extends TeamChatScope {
    /** `direct` or `group`. */
    readonly kind: "direct" | "group"
    /** The name of a group. */
    readonly name: string | null
    /** The other members. */
    readonly members: ReadonlyArray<MemberRef>
}

/** A member added to or removed from a room. */
export interface RoomMemberRequest extends RoomRequest {
    /** The member. */
    readonly member: MemberRef
}

/** A message to send. */
export interface SendMessageRequest extends TeamChatScope {
    /** The room; null for the first message to a member. */
    readonly roomId: string | null
    /** The member a first message goes to. */
    readonly to: MemberRef | null
    /** The text. */
    readonly body: string
    /** The members it mentions. */
    readonly mentions: ReadonlyArray<MemberRef>
    /** The files it carries. */
    readonly fileKeys: ReadonlyArray<string>
    /** The retry key. */
    readonly clientId: string | null
}

/** A read position. */
export interface MarkReadRequest extends RoomRequest {
    /** The message read up to; null is the newest. */
    readonly messageId: string | null
}

/** A file to upload to a room. */
export interface RequestUploadRequest extends RoomRequest, UploadAsk {}

/** The mute of a room for the caller. */
export interface SetMutedRequest extends RoomRequest {
    /** True to mute. */
    readonly muted: boolean
}

/** A verdict on the decision an approval card is about. */
export interface DecideRequest extends TeamChatScope {
    /** The decision (the approval request). */
    readonly decisionId: string
    /** Approve or reject. */
    readonly verdict: "approve" | "reject"
}

/** How a decision verdict ended: the state every card of the decision now shows, or why the verdict was refused. */
export type DecideOutcome =
    | { readonly ok: true; readonly approval: ApprovalState }
    | { readonly ok: false; readonly refusal: "decision_not_found" | "not_an_approver" | "decision_closed" }

/** A pin of one message. */
export interface PinRequest extends RoomRequest {
    /** The message. */
    readonly messageId: string
}
