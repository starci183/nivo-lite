import type {
    AgentPosted,
    ApprovalRequestView,
    ApprovalState,
    Attachment,
    ChatMemberRef,
    ChatRoomView,
    LinePosted,
    ReportPosted,
    RoomKind,
    StoredMention,
} from "./team-chat.contracts"
import type { ThreadPosition } from "./team-chat.policy"

/** An id, or none. */
export type OptionalId = string | null
/** A count, or none. */
export type OptionalCount = number | null
/** A room kind, or none. */
export type OptionalKind = RoomKind | null
/** A thread position, or none. */
export type OptionalPosition = ThreadPosition | null
/** A member, or none. */
export type OptionalMember = ChatMemberRef | null
/** A stored card, or none. */
export type OptionalCard = StoredCard | null
/** A room as a viewer reads it, or none. */
export type OptionalRoomView = ChatRoomView | null
/** The state of an approval for a viewer, or none. */
export type OptionalApprovalState = ApprovalState | null
/** The request an approval card is about, or none. */
export type OptionalApprovalRequest = ApprovalRequestView | null
/** A posted report, or none. */
export type OptionalReport = ReportPosted | null
/** A posted line, or none. */
export type OptionalLine = LinePosted | null
/** A line posted as an agent, or none. */
export type OptionalAgentLine = AgentPosted | null

/** What a room list is narrowed to: who reads it, whether that person sees every room, and the optional kind and member filters. */
export interface RoomFilter {
    /** The person who reads the list; their own seat never counts for the member filter. */
    readonly viewerId: string
    /** Whether the viewer owns the workspace and so sees rooms they do not sit in. */
    readonly owner: boolean
    /** Only rooms of this kind; null for both kinds. */
    readonly kind: RoomKind | null
    /** Only rooms that this other member sits in; null for no member filter. */
    readonly member: string | null
}

/** A room to open: its kind, name, pair key, creator and the members who join the creator. */
export interface NewRoom {
    /** The workspace the room belongs to. */
    readonly workspaceId: string
    /** The person who opens it and becomes its owner. */
    readonly createdBy: string
    /** Whether it is a pair or a group. */
    readonly kind: RoomKind
    /** The name of a group; null for a direct room. */
    readonly name: string | null
    /** The sorted pair of a direct room, so the same pair has one room; null for a group. */
    readonly directKey: string | null
    /** The members who join besides the creator. */
    readonly others: ReadonlyArray<ChatMemberRef>
}

/** A text message of a person to store. */
export interface NewText {
    /** The workspace of the room. */
    readonly workspaceId: string
    /** The room the message is written in. */
    readonly roomId: string
    /** The person who writes it. */
    readonly authorId: string
    /** The text of the message. */
    readonly body: string
    /** The author's retry key; null when the author sends none. */
    readonly clientId: string | null
    /** The members it mentions, as the row keeps them. */
    readonly mentions: ReadonlyArray<StoredMention>
    /** The checked files it carries. */
    readonly attachments: ReadonlyArray<Attachment>
}

/** What kind of engine card a message is. */
export type CardKind = "report" | "approval"

/** A report or approval card to store. */
export interface NewCard {
    /** The workspace of the room. */
    readonly workspaceId: string
    /** The room the card sits in. */
    readonly roomId: string
    /** The agent that speaks; null when the system does. */
    readonly authorId: string | null
    /** A report of a run or an approval card of a decision. */
    readonly kind: CardKind
    /** The run of a report or the decision of an approval card. */
    readonly refId: string
    /** The words of the card, already cut to the bound. */
    readonly body: string
}

/** A line of an agent or of the system to store. */
export interface NewLine {
    /** The workspace of the room. */
    readonly workspaceId: string
    /** The room the line is written in. */
    readonly roomId: string
    /** The agent that speaks; null for a system line. */
    readonly authorAgentId: string | null
    /** The words of the line, already cut to the bound. */
    readonly body: string
    /** The retry key; null when the line has none. */
    readonly key: string | null
}

/** A card the store holds: its message and whether this write made it. */
export interface StoredCard {
    /** The message that is the card. */
    readonly messageId: string
    /** False when a retry found the card an earlier write made. */
    readonly created: boolean
}

/** One row of the unread query: counts come back from the database as text. */
export interface UnreadRow {
    /** The room. */
    readonly room_id: string
    /** The unread messages of others, as the text of a bigint. */
    readonly unread: string
    /** The unread messages that mention the viewer, as the text of a bigint. */
    readonly mentions: string
}
