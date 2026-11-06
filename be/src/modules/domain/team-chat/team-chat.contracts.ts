import type { TeamChatErrorCode } from "./errors/team-chat.error"

/** The most characters a person's message holds. */
export const BODY_MAX = 8000

/** The most members a message mentions. */
export const MENTIONS_MAX = 20

/** The most files a message carries. */
export const FILES_MAX = 10

/** The most members a room view lists. */
export const MEMBERS_MAX = 200

/** The most rooms a list read holds. */
export const ROOMS_MAX = 500

/** The page sizes of the thread. */
export const PAGE_DEFAULT = 30
export const PAGE_MAX = 100

/** What a member can be: a person of the workspace or an agent of it. */
export type MemberKind = "user" | "agent"

/** A person or an agent named by kind and id. */
export interface MemberRef {
    /** `user` or `agent`. */
    readonly memberKind: MemberKind
    /** The account id or the agent id. */
    readonly memberId: string
}

/** The member of a room as a screen shows it. */
export interface RoomMemberView extends MemberRef {
    /** The name shown. */
    readonly name: string
    /** `owner` or `member`. */
    readonly role: "owner" | "member"
    /** Where the member last read. */
    readonly lastReadAt: Date
    /** Whether the member muted the room. */
    readonly muted: boolean
}

/** Where the decision an approval card is about stands, for one viewer. */
export interface ApprovalState {
    /** The decision. */
    readonly decisionId: string
    /** Pending, or how it ended. */
    readonly status: "pending" | "approved" | "refused" | "expired"
    /** Who settled it. */
    readonly decidedByName: string | null
    /** When it was settled. */
    readonly decidedAt: Date | null
    /** Whether the viewer is one of the approvers of a pending decision. */
    readonly canDecide: boolean
}

/** One message as a screen shows it. */
export interface MessageView {
    readonly id: string
    readonly roomId: string
    readonly kind: "text" | "report" | "approval" | "system"
    readonly authorKind: "user" | "agent" | "system"
    readonly authorId: string | null
    readonly authorName: string
    readonly body: string
    readonly createdAt: Date
    readonly editedAt: Date | null
    readonly pinned: boolean
    readonly mentions: ReadonlyArray<MemberRef & { readonly name: string }>
    readonly attachments: ReadonlyArray<Attachment & { readonly url: string }>
    /** The run a report is about; null for any other kind. */
    readonly runId: string | null
    /** The decision an approval card is about; null for any other kind. */
    readonly decisionId: string | null
    /** The state of that decision; null for any other kind. */
    readonly approval: ApprovalState | null
}

/** One room as a screen shows it, for one viewer. */
export interface RoomView {
    readonly id: string
    readonly kind: "direct" | "group"
    readonly name: string
    readonly position: number
    readonly createdBy: string
    readonly createdAt: Date
    readonly members: ReadonlyArray<RoomMemberView>
    readonly unreadCount: number
    readonly mentionCount: number
    readonly muted: boolean
    readonly lastMessage: MessageView | null
}

/** One page of a thread, newest first. */
export interface MessagePage {
    readonly nodes: ReadonlyArray<MessageView>
    readonly hasNextPage: boolean
    readonly endCursor: string | null
}

/** What a room has unread for one viewer. */
export interface RoomUnread {
    readonly roomId: string
    readonly unreadCount: number
    readonly mentionCount: number
}

/** What every room has unread for one viewer. */
export interface UnreadView {
    readonly total: number
    readonly mentionTotal: number
    readonly rooms: ReadonlyArray<RoomUnread>
}

/** An operation that answers its value or a refusal code, never throws for a domain case. */
export type TeamChatResult<V> =
    { readonly ok: true; readonly value: V } | { readonly ok: false; readonly refusal: TeamChatErrorCode }

/** A file a message carries, checked at send. */
export interface Attachment {
    /** The key of the stored object. */
    readonly fileKey: string
    /** The name it was sent under. */
    readonly name: string
    /** Its type. */
    readonly mimeType: string
    /** Its size, bytes. */
    readonly sizeBytes: number
}

/** A file about to be uploaded. */
export interface UploadAsk {
    /** The name on the sender's side. */
    readonly fileName: string
    /** The declared type. */
    readonly mimeType: string
    /** The declared size, bytes. */
    readonly sizeBytes: number
}

/** The address a browser uploads a file to, and the key the message names it by. */
export interface ChatUpload {
    /** The key to name in `sendChatMessage`. */
    readonly fileKey: string
    /** Where to send the bytes. */
    readonly uploadUrl: string
    /** The HTTP method. */
    readonly method: "PUT"
    /** The headers the upload must carry. */
    readonly headers: ReadonlyArray<{ readonly name: string; readonly value: string }>
    /** When the address stops working. */
    readonly expiresAt: Date
}

/** The input of a send. */
export interface SendInput {
    /** The room; null when the message is the first to a member (then `to` names them). */
    readonly roomId: string | null
    /** The member a first message goes to; the direct room with them is opened when it does not exist. */
    readonly to: MemberRef | null
    readonly body: string
    readonly mentions: ReadonlyArray<MemberRef>
    readonly fileKeys: ReadonlyArray<string>
    readonly clientId: string | null
}
