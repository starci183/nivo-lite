import type { BrainChangeCardView } from "./brain-change-card.contracts"
import type { TeamChatErrorCode } from "./errors/team-chat.error"
import type { ReactionView, ReplyView } from "./team-chat-reaction.contracts"
import type { StopCardView } from "./stop-card.contracts"

/** The most characters a person's message holds; a longer body is refused so one message cannot swell a thread page. */
export const BODY_MAX = 8000

/** The most members a message mentions; a longer list is refused so one message cannot wake a whole workspace of agents. */
export const MENTIONS_MAX = 20

/** The most files a message carries; the database check on the attachments column holds the same bound. */
export const FILES_MAX = 10

/** The most members a room view lists; it bounds every read of the members of one room. */
export const MEMBERS_MAX = 200

/** The most rooms a list read holds; it bounds the rooms one person or one owner reads at a time. */
export const ROOMS_MAX = 500

/** The size of a thread page when the caller names none. */
export const PAGE_DEFAULT = 30

/** The largest thread page a caller may ask for. */
export const PAGE_MAX = 100

/** What a member can be: a person of the workspace or an agent of it. */
export type MemberKind = "user" | "agent"

/** What a room is: a pair of members or a named group. */
export type RoomKind = "direct" | "group"

/**
 * What a room is for: `direct` (a pair), `group` (a plain named group), `common` (the one room of the whole workspace) or `module` (the one
 * room of a module's team). An agent addresses a room by its purpose, never by its id.
 */
export type RoomPurpose = "direct" | "group" | "common" | "module"

/** The purpose a group may be given: plain, the common room, or the room of one module's team. */
export type GroupPurpose =
    | { readonly purpose: "group" | "common" }
    | {
          readonly purpose: "module"
          /** The module (department) whose team room it is. */
          readonly module: string
      }

/** What a member may do in a room: an owner manages the members of a group, a member only takes part. */
export type RoomRole = "owner" | "member"

/** What a message is: a person's text, a run report, an approval card or a system line. */
export type MessageKind = "text" | "report" | "approval" | "system"

/** Who wrote a message: a person, an agent, or the system itself. */
export type AuthorKind = "user" | "agent" | "system"

/** Where a decision stands as a card shows it: waiting, or how it ended. */
export type ApprovalCardStatus = "pending" | "approved" | "refused" | "expired"

/** A person or an agent named by kind and id. */
export interface ChatMemberRef {
    /** Whether the member is a person (`user`) or an agent (`agent`); the same id can name one of each. */
    readonly memberKind: MemberKind
    /** The account id of a person or the id of an agent. */
    readonly memberId: string
}

/** The member of a room as a screen shows it. */
export interface RoomMemberView extends ChatMemberRef {
    /** The name the screen prints next to the member. */
    readonly name: string
    /** Whether the member manages the room or only takes part. */
    readonly role: RoomRole
    /** The instant before which every message of the room counts as read for this member. */
    readonly lastReadAt: Date
    /** Whether the member silenced the room, so a screen shows no alert for it. */
    readonly muted: boolean
    /** Whether an agent seat holds the right to post in this group; always false for a person. */
    readonly mayPost: boolean
}

/** Where the decision an approval card is about stands, for one viewer. */
export interface ApprovalState {
    /** The decision the card stands for. */
    readonly decisionId: string
    /** Waiting for the approvers, or how the decision ended. */
    readonly status: ApprovalCardStatus
    /** The name of the person who settled it; null while it waits or when it ran out of time. */
    readonly decidedByName: string | null
    /** When it was settled; null while it waits. */
    readonly decidedAt: Date | null
    /** Whether the viewer is one of the approvers of a pending decision, so the card shows the decide buttons. */
    readonly canDecide: boolean
}

/** A member a message mentions, with the name a screen prints for it. */
export interface MentionView extends ChatMemberRef {
    /** The name printed for the mentioned member; empty when the member left the workspace. */
    readonly name: string
}

/** A file a message carries, with the short-lived address that reads it. */
export interface AttachmentView extends Attachment {
    /** The signed address that reads the file; empty when the store did not sign one. */
    readonly url: string
}

/** One message as a screen shows it. */
export interface MessageView {
    /** The message id, the key of a pin and of a read position. */
    readonly id: string
    /** The room the message was written in. */
    readonly roomId: string
    /** What the message is, so a screen picks a bubble, a report card or an approval card. */
    readonly kind: MessageKind
    /** Whether a person, an agent or the system wrote it. */
    readonly authorKind: AuthorKind
    /** The account or agent that wrote it; null for a system line. */
    readonly authorId: string | null
    /** The name printed for the author; empty for a system line. */
    readonly authorName: string
    /** The text of the message, or the words of a card. */
    readonly body: string
    /** When the message was written, as the database clock saw it. */
    readonly createdAt: Date
    /** When the message was edited; null when it never was. */
    readonly editedAt: Date | null
    /** Whether the message is pinned in its room. */
    readonly pinned: boolean
    /** The members the author mentioned, in the order written. */
    readonly mentions: ReadonlyArray<MentionView>
    /** The files the message carries, each with its read address. */
    readonly attachments: ReadonlyArray<AttachmentView>
    /** The run a report is about; null for any other kind. */
    readonly runId: string | null
    /** The decision an approval card is about; null for any other kind. */
    readonly decisionId: string | null
    /** The state of that decision; null for any other kind. */
    readonly approval: ApprovalState | null
    /** The structured message of an agent, as JSON text, when the line carries one; null otherwise. */
    readonly agentMessage: string | null
    /** The emoji on the message, summed over the members, the most tapped first; empty when none. */
    readonly reactions: ReadonlyArray<ReactionView>
    /** The message this one answers, as a quote; null when it answers none. */
    readonly replyTo: ReplyView | null
    /** Whose words a forwarded message carries (empty when the author is unknown); null when the message was not forwarded. */
    readonly forwardedFrom: string | null
    /** The typed stop a `workflow.stopped` card is about (its state, needs and the founder's replies); null for any other line. */
    readonly stop: StopCardView | null
    /** The truth-graph change card (`brain.change`) as this viewer sees it; null for every other line. */
    readonly brainChange: BrainChangeCardView | null
}

/** One room as a screen shows it, for one viewer. */
export interface ChatRoomView {
    /** The room id. */
    readonly id: string
    /** Whether the room is a pair or a group. */
    readonly kind: RoomKind
    /** What the room is for. */
    readonly purpose: RoomPurpose
    /** The module whose team room it is; null unless the purpose is `module`. */
    readonly purposeModule: string | null
    /** The name printed for the room: the group name, or the other member of a direct room. */
    readonly name: string
    /** Where the room sorts among rooms that have no message. */
    readonly position: number
    /** The account that opened the room. */
    readonly createdBy: string
    /** When the room was opened. */
    readonly createdAt: Date
    /** The members of the room, owners first. */
    readonly members: ReadonlyArray<RoomMemberView>
    /** How many messages the viewer has not read in this room. */
    readonly unreadCount: number
    /** How many of those unread messages mention the viewer. */
    readonly mentionCount: number
    /** Whether the viewer muted the room. */
    readonly muted: boolean
    /** The newest message of the room; null when it has none. */
    readonly lastMessage: MessageView | null
}

/** One page of a thread, newest first. */
export interface MessagePage {
    /** The messages of the page, newest first. */
    readonly nodes: ReadonlyArray<MessageView>
    /** Whether older messages remain after this page. */
    readonly hasNextPage: boolean
    /** The cursor to pass as `after` to read the next page; null on the last page. */
    readonly endCursor: string | null
}

/** What a room has unread for one viewer. */
export interface RoomUnread {
    /** The room the counts are about. */
    readonly roomId: string
    /** How many messages written by others the viewer has not read. */
    readonly unreadCount: number
    /** How many of those mention the viewer. */
    readonly mentionCount: number
}

/** What every room has unread for one viewer. */
export interface UnreadView {
    /** The unread messages summed over every room, for the badge of the whole chat. */
    readonly total: number
    /** The unread mentions summed over every room. */
    readonly mentionTotal: number
    /** The rooms that have something unread. */
    readonly rooms: ReadonlyArray<RoomUnread>
}

/** The answer of an operation that went through: the value it made. */
export interface ChatDone<V> {
    /** Always true: the operation went through. */
    readonly ok: true
    /** What the operation made. */
    readonly value: V
}

/** The answer of an operation that a domain rule refused. */
export interface ChatRefused {
    /** Always false: the operation was refused. */
    readonly ok: false
    /** The stable code of the rule that refused it. */
    readonly refusal: TeamChatErrorCode
}

/** An operation that answers its value or a refusal code, never throws for a domain case. */
export type TeamChatResult<V> = ChatDone<V> | ChatRefused

/** A file a message carries, checked at send. */
export interface Attachment {
    /** The key of the stored object, which names the workspace, the room and the file name. */
    readonly fileKey: string
    /** The name the file was sent under. */
    readonly name: string
    /** The type of the file, as its extension stands for it. */
    readonly mimeType: string
    /** The size of the stored object, in bytes. */
    readonly sizeBytes: number
}

/** A file about to be uploaded. */
export interface UploadAsk {
    /** The name of the file on the sender's side; the key keeps a safe form of it. */
    readonly fileName: string
    /** The type the sender declares; it must be one the chat carries. */
    readonly mimeType: string
    /** The size the sender declares, in bytes; it must be within the limit. */
    readonly sizeBytes: number
}

/** One header an upload must carry. */
export interface UploadHeader {
    /** The header name. */
    readonly name: string
    /** The header value. */
    readonly value: string
}

/** The address a browser uploads a file to, and the key the message names it by. */
export interface ChatUpload {
    /** The key to name in `sendChatMessage`, so the message finds the stored object. */
    readonly fileKey: string
    /** Where to send the bytes. */
    readonly uploadUrl: string
    /** The HTTP method the upload uses. */
    readonly method: "PUT"
    /** The headers the signed address requires. */
    readonly headers: ReadonlyArray<UploadHeader>
    /** When the address stops working. */
    readonly expiresAt: Date
}

/** What a person types into a room, or into a first message to someone (then `to` names the one it goes to). */
export interface SendInput {
    /** The room; null when the message is the first to a member (then `to` names them). */
    readonly roomId: string | null
    /** The member a first message goes to; the direct room with them is opened when it does not exist. */
    readonly to: ChatMemberRef | null
    /** The text of the message; it may be empty when files are sent. */
    readonly body: string
    /** The members the message mentions; an agent mentioned is handed the text. */
    readonly mentions: ReadonlyArray<ChatMemberRef>
    /** The keys of the uploaded files the message carries. */
    readonly fileKeys: ReadonlyArray<string>
    /** The author's retry key: the same key from the same author in the same room is the same message. */
    readonly clientId: string | null
    /** The message of the same room this one answers; null or omitted for none. */
    readonly replyTo?: string | null
}

/** The input of opening a room. */
export interface CreateRoomInput {
    /** Whether to open a pair or a named group. */
    readonly kind: RoomKind
    /** The name of a group; null for a direct room. */
    readonly name: string | null
    /** The members to add besides the person who opens it. */
    readonly members: ReadonlyArray<ChatMemberRef>
    /** What a group is for; a plain group when omitted. A direct room is always `direct`. */
    readonly purpose?: GroupPurpose | undefined
}

/** The report of a finished run to write as a card. */
export interface ReportInput {
    /** The run the report is about; one report exists per run and room. */
    readonly runId: string
    /** The agent that ran, whose direct room with the owner receives the report by default. */
    readonly agentId: string
    /** The words of the card. */
    readonly body: string
    /** The room the agent is configured to report to; null for the direct room with the owner. */
    readonly roomId: string | null
}

/** Where a report card went and whether this write made it. */
export interface ReportPosted {
    /** The room the card sits in. */
    readonly roomId: string
    /** The message that is the card. */
    readonly messageId: string
    /** False when a retry found the card an earlier write made. */
    readonly created: boolean
}

/** The approval card of one decision to post. */
export interface ApprovalPostInput {
    /** The decision the cards stand for. */
    readonly decisionId: string
    /** The words of the card. */
    readonly body: string
    /** The agent that asked; null when the system asks, and then no direct room is opened. */
    readonly agentId: string | null
    /** The rooms the rule names, each of which receives a card. */
    readonly roomIds: ReadonlyArray<string>
    /** The approver seats the rule names one by one, each of whom receives a card in a direct room with the agent. */
    readonly approverSeatIds: ReadonlyArray<string>
}

/** One line of an agent, or of the system, to write into a room. */
export interface LineInput {
    /** The agent that speaks; null for a system line. */
    readonly authorAgentId: string | null
    /** The room to write in; null when the line goes to one person. */
    readonly roomId: string | null
    /** The person the line goes to, in the direct room between them and the agent. */
    readonly toUserId: string | null
    /** The text of the line. */
    readonly body: string
    /** The retry key: the same key from the same agent in the same room is the same line. */
    readonly key: string | null
    /** The structured message the line carries as JSON text, or null for a plain line. */
    readonly agentMessage?: string | null
    /** The message of the same room this line answers; null or omitted for none. */
    readonly replyTo?: string | null
}

/** Where a line went. */
export interface LinePosted {
    /** The room the line sits in. */
    readonly roomId: string
    /** The message that is the line. */
    readonly messageId: string
}

/** One line to say as an agent to one person. */
export interface AgentPostInput {
    /** The agent, named by its id or by the key of its module. */
    readonly agent: string
    /** The person to say it to; null for the owner of the workspace. */
    readonly toUserId: string | null
    /** The text of the line. */
    readonly body: string
    /** The retry key of the line. */
    readonly key: string | null
    /** The structured message the line carries as JSON text, or null for a plain line. */
    readonly agentMessage?: string | null
}

/** Where a line of an agent went, and which agent spoke. */
export interface AgentPosted extends LinePosted {
    /** The agent that spoke, once the name was resolved. */
    readonly agentId: string
}

/** The request a decision card is about, with the approver group it stored. */
export interface ApprovalRequestView {
    /** The request id, which is the decision id of its cards. */
    readonly id: string
    /** The action the request asks about. */
    readonly action: string
    /** The amount of the action; null when it carries none. */
    readonly amount: number | null
    /** What the amount is counted in. */
    readonly unit: string
    /** The agent that asked; null when none did. */
    readonly requestedByAgentId: string | null
    /** The approver group the request kept in place of the live rule; null for a request of a rule. */
    readonly storedGroup: unknown
}

/** A member as a message row keeps a mention of it. */
export interface StoredMention {
    /** Whether the mentioned member is a person or an agent. */
    readonly kind: MemberKind
    /** The account id or the agent id. */
    readonly id: string
}

/** The one engine object a card is about: a run for a report, a decision for an approval. */
export interface MessageRef {
    /** The run a report is about. */
    readonly run_id?: string
    /** The decision an approval card is about. */
    readonly decision_id?: string
    /** The structured message an agent said (its kind, intent and payload) as JSON text, which a screen draws as a card; the line itself stays readable text. */
    readonly agent_message?: string
    /** Whose words a forwarded message carries: the name of the author of the message that was forwarded. */
    readonly forwarded_from?: string
}
